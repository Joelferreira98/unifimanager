import axios, { AxiosInstance } from 'axios'
import https from 'https'

interface UnifiVoucher {
  id: string
  createdAt: string
  name: string
  code: string
  authorizedGuestLimit?: number
  authorizedGuestCount: number
  activatedAt?: string
  expiresAt?: string
  expired: boolean
  timeLimitMinutes: number
  dataUsageLimitMBytes?: number
  rxRateLimitKbps?: number
  txRateLimitKbps?: number
}

interface PaginatedResponse<T> {
  offset: number
  limit: number
  count: number
  totalCount: number
  data: T[]
}

interface CreateVoucherPayload {
  name: string
  count: number
  timeLimitMinutes: number
  dataUsageLimitMBytes?: number
  rxRateLimitKbps?: number
  txRateLimitKbps?: number
  authorizedGuestLimit?: number
}

class UnifiService {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: `${process.env.UNIFI_HOST}/proxy/network/integration`,
      headers: {
        'X-API-KEY': process.env.UNIFI_API_KEY,
        'Content-Type': 'application/json',
      },
      // Certificado autoassinado em instalações locais
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
    })
  }

  async getVouchers(siteId: string, filter?: string): Promise<UnifiVoucher[]> {
    const results: UnifiVoucher[] = []
    let offset = 0
    const limit = 200

    while (true) {
      const params: Record<string, unknown> = { offset, limit }
      if (filter) params.filter = filter

      const { data } = await this.client.get<PaginatedResponse<UnifiVoucher>>(
        `/v1/sites/${siteId}/hotspot/vouchers`,
        { params }
      )

      results.push(...data.data)

      if (offset + data.count >= data.totalCount) break
      offset += limit
    }

    return results
  }

  async getVoucher(siteId: string, voucherId: string): Promise<UnifiVoucher> {
    const { data } = await this.client.get<UnifiVoucher>(
      `/v1/sites/${siteId}/hotspot/vouchers/${voucherId}`
    )
    return data
  }

  async createVouchers(siteId: string, payload: CreateVoucherPayload): Promise<UnifiVoucher[]> {
    // `count` é obrigatório: sem ele a API responde com um voucher mas NÃO persiste nada.
    // A criação é em lote e responde com { vouchers: [...] } já persistidos.
    const { data } = await this.client.post<{ vouchers: UnifiVoucher[] }>(
      `/v1/sites/${siteId}/hotspot/vouchers`,
      payload
    )
    return data.vouchers
  }

  async deleteVoucher(siteId: string, voucherId: string): Promise<void> {
    await this.client.delete(`/v1/sites/${siteId}/hotspot/vouchers/${voucherId}`)
  }

  async getSites(): Promise<{ id: string; name: string; internalReference: string }[]> {
    const { data } = await this.client.get<PaginatedResponse<{ id: string; name: string; internalReference: string }>>(
      '/v1/sites'
    )
    return data.data
  }

  async authorizeGuest(
    siteId: string,
    clientId: string,
    options: {
      timeLimitMinutes?: number
      dataUsageLimitMBytes?: number
      rxRateLimitKbps?: number
      txRateLimitKbps?: number
    }
  ): Promise<void> {
    await this.client.post(`/v1/sites/${siteId}/clients/${clientId}/actions`, {
      action: 'AUTHORIZE_GUEST_ACCESS',
      ...options,
    })
  }
}

export const unifiService = new UnifiService()
