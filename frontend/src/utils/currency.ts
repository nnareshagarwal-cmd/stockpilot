/**
 * Indian Number and Currency formatting utilities
 * Formats numbers according to Indian numbering system (Lakhs, Crores):
 * e.g. 10,000 | 1,10,000 | 10,00,000 | 1,00,00,000
 */

/**
 * Formats a raw number or string into Indian comma notation.
 * Ideal for Ant Design InputNumber `formatter` prop.
 */
export const formatIndianNumber = (value: number | string | undefined | null): string => {
  if (value === undefined || value === null || value === '') return ''
  const str = `${value}`.replace(/,/g, '')
  if (str === '-' || isNaN(Number(str))) return str

  const isNegative = str.startsWith('-')
  const cleanStr = isNegative ? str.slice(1) : str
  const parts = cleanStr.split('.')
  const integerPart = parts[0]
  const decimalPart = parts.length > 1 ? `.${parts[1]}` : ''

  if (integerPart.length <= 3) {
    return `${isNegative ? '-' : ''}${integerPart}${decimalPart}`
  }

  const lastThree = integerPart.slice(-3)
  const remaining = integerPart.slice(0, -3)
  const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',')

  return `${isNegative ? '-' : ''}${formattedRemaining},${lastThree}${decimalPart}`
}

/**
 * Strips commas from formatted string back to raw numeric string.
 * Ideal for Ant Design InputNumber `parser` prop.
 */
export const parseIndianNumber = (value: string | undefined): string => {
  return value ? value.replace(/,/g, '') : ''
}

/**
 * Formats value as Indian currency string with optional rupee symbol.
 * e.g. 110000 -> ₹1,10,000.00 (or ₹1,10,000 when decimals=false)
 */
export const formatIndianCurrency = (
  value: number | string | undefined | null,
  options: {
    showDecimals?: boolean
    prefix?: string
  } = {}
): string => {
  const { showDecimals = true, prefix = '₹' } = options
  if (value === undefined || value === null || value === '') {
    return `${prefix}0${showDecimals ? '.00' : ''}`
  }

  const num = Number(value)
  if (isNaN(num)) return `${prefix}0${showDecimals ? '.00' : ''}`

  const formatted = num.toLocaleString('en-IN', {
    minimumFractionDigits: showDecimals ? 2 : 0,
    maximumFractionDigits: showDecimals ? 2 : 0,
  })

  return `${prefix}${formatted}`
}
