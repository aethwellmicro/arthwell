import { db } from '@/lib/db'
import { json, error, withAuth, parseBody } from '@/lib/api'
import { logAudit } from '@/lib/audit'
import { ROLE_ADMIN, ROLE_BRANCH_MANAGER } from '@/lib/auth'
import { calculateLoan } from '@/lib/calc'
import { z } from 'zod'

const productSchema = z.object({
  productCode: z.string().min(1, 'Product code is required').max(50),
  name: z.string().min(1, 'Product name is required').max(100),
  loanType: z.string().default('JLG / Group Loan'),
  principal: z.coerce.number().positive('Principal must be greater than 0'),
  interestRate: z.coerce.number().min(0, 'Valid interest rate is required'),
  interestBasis: z.enum(['YEARLY', 'MONTHLY', 'FLAT_PERIOD']).default('YEARLY'),
  interestMethod: z.enum(['REDUCING', 'FLAT']).default('REDUCING'),
  tenure: z.coerce.number().int().positive('Tenure must be greater than 0'),
  frequency: z.enum(['WEEKLY', 'MONTHLY', 'DAILY']).default('WEEKLY'),
  savingsAmount: z.coerce.number().min(0).default(100),
  processingFee: z.coerce.number().min(0).default(0),
  insurancePremium: z.coerce.number().min(0).default(0),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ARCHIVED']).default('ACTIVE'),
})

// Seed defaults if empty
const DEFAULT_PRODUCTS = [
  {
    productCode: 'AMF-WL-20000',
    name: 'ArthWell ₹20,000 Weekly Loan',
    loanType: 'JLG / Group Loan',
    principal: 20000,
    interestRate: 12.5,
    interestBasis: 'FLAT_PERIOD',
    interestMethod: 'REDUCING',
    tenure: 25,
    frequency: 'WEEKLY',
    emiAmount: 900.03,
    savingsAmount: 100,
    processingFee: 750,
    insurancePremium: 750,
    status: 'ACTIVE',
  },
  {
    productCode: 'AMF-WL-50000-25',
    name: 'ArthWell ₹50,000 / 25 Week Loan',
    loanType: 'JLG / Group Loan',
    principal: 50000,
    interestRate: 25,
    interestBasis: 'FLAT_PERIOD',
    interestMethod: 'REDUCING',
    tenure: 25,
    frequency: 'WEEKLY',
    emiAmount: 2500.10,
    savingsAmount: 100,
    processingFee: 1875,
    insurancePremium: 1875,
    status: 'ACTIVE',
  },
  {
    productCode: 'AMF-WL-50000-50',
    name: 'ArthWell ₹50,000 / 50 Week Loan',
    loanType: 'JLG / Group Loan',
    principal: 50000,
    interestRate: 22.83,
    interestBasis: 'YEARLY',
    interestMethod: 'REDUCING',
    tenure: 50,
    frequency: 'WEEKLY',
    emiAmount: 1250.09,
    savingsAmount: 100,
    processingFee: 3750,
    insurancePremium: 3750,
    status: 'ACTIVE',
  },
  {
    productCode: 'AMF-WL-100000-50',
    name: 'ArthWell ₹1,00,000 / 50 Week Loan',
    loanType: 'JLG / Group Loan',
    principal: 100000,
    interestRate: 22.83,
    interestBasis: 'YEARLY',
    interestMethod: 'REDUCING',
    tenure: 50,
    frequency: 'WEEKLY',
    emiAmount: 2500.19,
    savingsAmount: 100,
    processingFee: 7500,
    insurancePremium: 7500,
    status: 'ACTIVE',
  },
  {
    productCode: 'AMF-WL-100000-25',
    name: 'ArthWell ₹1,00,000 / 25 Week Loan',
    loanType: 'JLG / Group Loan',
    principal: 100000,
    interestRate: 25,
    interestBasis: 'FLAT_PERIOD',
    interestMethod: 'REDUCING',
    tenure: 25,
    frequency: 'WEEKLY',
    emiAmount: 5000.20,
    savingsAmount: 100,
    processingFee: 3750,
    insurancePremium: 3750,
    status: 'ACTIVE',
  },
]

export async function GET(req: Request) {
  return withAuth(async () => {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') || undefined

    const count = await db.loanProduct.count()
    if (count === 0) {
      // Initialize system loan products
      for (const p of DEFAULT_PRODUCTS) {
        await db.loanProduct.upsert({
          where: { productCode: p.productCode },
          update: {},
          create: p,
        })
      }
    }

    const where: any = {}
    if (status && status !== 'ALL') where.status = status

    const products = await db.loanProduct.findMany({
      where,
      orderBy: { principal: 'asc' },
    })

    const items = products.map((p) => ({
      ...p,
      principal: Number(p.principal),
      interestRate: Number(p.interestRate),
      emiAmount: Number(p.emiAmount),
      savingsAmount: Number(p.savingsAmount),
      processingFee: Number(p.processingFee),
      insurancePremium: Number(p.insurancePremium),
      totalFees: Number(p.processingFee) + Number(p.insurancePremium),
      totalWeeklyCollection: Number(p.emiAmount) + Number(p.savingsAmount),
    }))

    return json({ items })
  })
}

export async function POST(req: Request) {
  return withAuth(async (user) => {
    if (user.role !== ROLE_ADMIN && user.role !== ROLE_BRANCH_MANAGER) {
      return error('Unauthorized to configure loan products.', 403)
    }

    const body = await parseBody(req)
    const parsed = productSchema.safeParse(body)
    if (!parsed.success) {
      return error(parsed.error.issues[0].message, 422)
    }
    const data = parsed.data

    const existing = await db.loanProduct.findUnique({
      where: { productCode: data.productCode.trim() },
    })
    if (existing) {
      return error(`A loan product with code "${data.productCode.trim()}" already exists.`, 409)
    }

    // Authoritative calculation of EMI
    const computed = calculateLoan({
      principal: data.principal,
      interestRate: data.interestRate,
      interestType: data.interestMethod as any,
      interestPeriod: data.interestBasis as any,
      tenure: data.tenure,
      installmentFreq: data.frequency as any,
      startDate: new Date(),
    })

    const created = await db.loanProduct.create({
      data: {
        productCode: data.productCode.trim(),
        name: data.name.trim(),
        loanType: data.loanType,
        principal: data.principal,
        interestRate: data.interestRate,
        interestBasis: data.interestBasis,
        interestMethod: data.interestMethod,
        tenure: data.tenure,
        frequency: data.frequency,
        emiAmount: computed.installmentAmount,
        savingsAmount: data.savingsAmount,
        processingFee: data.processingFee,
        insurancePremium: data.insurancePremium,
        status: data.status,
      },
    })

    await logAudit({
      user,
      action: 'PRODUCT_CREATED',
      entity: 'LOAN_PRODUCT',
      entityId: created.id,
      newValue: { productCode: created.productCode, name: created.name, emiAmount: computed.installmentAmount },
    })

    return json({
      ...created,
      principal: Number(created.principal),
      interestRate: Number(created.interestRate),
      emiAmount: Number(created.emiAmount),
      savingsAmount: Number(created.savingsAmount),
      processingFee: Number(created.processingFee),
      insurancePremium: Number(created.insurancePremium),
      totalFees: Number(created.processingFee) + Number(created.insurancePremium),
    }, 201)
  })
}
