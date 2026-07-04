from app.functions import stubs


async def test_all_stub_functions_return_none():
    assert await stubs.get_package_price("tenant-1", "silver") is None
    assert await stubs.check_date_availability("tenant-1", "2026-08-01") is None
    assert await stubs.get_faq("tenant-1", "cancellation") is None
    assert await stubs.get_partners("tenant-1", "florist") is None
    assert await stubs.escalate_to_human("conv-1", "price_negotiation") is None
