import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

vi.mock('../src/services/loans.service', () => ({
  checkoutService: vi.fn(),
  checkinService: vi.fn(),
  fetchLoans: vi.fn(),
  getBookCopyLocation: vi.fn(),
  shelveBookCopy: vi.fn(),
  getBookCopyHistory: vi.fn(),
}));

import { getLoans } from '../src/controllers/loans.controller';
import * as loansService from '../src/services/loans.service';

const fetchLoansMock = vi.mocked(loansService.fetchLoans);

const ORG_ID = 'org-1';

describe('loans.controller', () => {
  beforeEach(() => {
    fetchLoansMock.mockReset();
  });

  it('passes search/status/user query params and the caller org to fetchLoans', async () => {
    const mockPayload = {
      data: [],
      pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
    };
    fetchLoansMock.mockResolvedValue(mockPayload);

    const req = {
      user: {
        userId: 'admin-1',
        role: 'ADMIN',
        name: 'Alice',
        email: 'a@example.com',
        organizationId: ORG_ID,
        organizationName: 'Test',
      },
      query: {
        userId: 'u1',
        status: 'active',
        search: 'dune herbert 9780441172719',
        page: '2',
        limit: '25',
      },
    } as unknown as Request;

    const json = vi.fn();
    const res = { json } as unknown as Response;

    await getLoans(req, res);

    expect(fetchLoansMock).toHaveBeenCalledWith(ORG_ID, {
      userId: 'u1',
      status: 'active',
      search: 'dune herbert 9780441172719',
      page: 2,
      limit: 25,
    });
    expect(json).toHaveBeenCalledWith(mockPayload);
  });
});
