import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

export interface PasswordHashRecord {
  salt: string
  hash: string
  paramsJson: string
}

interface PasswordParams {
  keyLength: number
  cost: number
  blockSize: number
  parallelization: number
  maxmem: number
}

const PASSWORD_PARAMS: PasswordParams = {
  keyLength: 64,
  cost: 16_384,
  blockSize: 8,
  parallelization: 1,
  maxmem: 32 * 1024 * 1024,
}

function derive(password: string, salt: string, params: PasswordParams): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      params.keyLength,
      {
        N: params.cost,
        r: params.blockSize,
        p: params.parallelization,
        maxmem: params.maxmem,
      },
      (error, derivedKey) => {
        if (error) reject(error)
        else resolve(derivedKey)
      },
    )
  })
}

export async function hashPassword(password: string): Promise<PasswordHashRecord> {
  const salt = randomBytes(16).toString('base64url')
  const hash = await derive(password, salt, PASSWORD_PARAMS)
  return {
    salt,
    hash: hash.toString('base64url'),
    paramsJson: JSON.stringify(PASSWORD_PARAMS),
  }
}

export async function verifyPassword(password: string, record: PasswordHashRecord): Promise<boolean> {
  const params = JSON.parse(record.paramsJson) as PasswordParams
  const expected = Buffer.from(record.hash, 'base64url')
  const actual = await derive(password, record.salt, params)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
