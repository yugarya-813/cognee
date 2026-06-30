import cognee, asyncio

async def main():
    await cognee.add("Acme's remote work policy allows 3 days per week. John is the CTO.")
    await cognee.cognify()
    results = await cognee.search("What is the remote work policy?")
    print(results)

asyncio.run(main())
