# Blinkit Product Price Scraper

Extract product pricing and availability data from Blinkit search results. Collect product names, current price, discounts, images, and IDs in a structured dataset—ideal for tracking price changes, building dashboards, and running competitive research.

## Features

- **Search-driven collection** — Fetch products for any keyword (e.g., milk, snacks, paneer)
- **Rich product details** — Get prices, discounts, images, availability, and identifiers
- **Location-aware results** — Collect data for a delivery area by setting a location
- **Deduplicated dataset** — Reduces repeats while collecting results across multiple loads
- **Analysis-ready output** — Clean JSON output suitable for spreadsheets and BI tools

## Use Cases

### Price Monitoring
Track price changes and discount patterns for grocery products on Blinkit.

### Market Research
Analyze pricing strategies, discount trends, and product availability across categories.

### Price Comparison
Build price comparison tools for grocery products across different delivery platforms.

### Inventory Analysis
Monitor product availability and delivery times for supply chain insights.

### Consumer Analytics
Gather pricing data for consumer behavior studies and shopping trend analysis.

---

## Input Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `search_query` | String | No | `milk` | Product search keyword(s) (e.g., milk, vegetables, snacks) |
| `search_url` | String | No | `""` | Full Blinkit search URL (overrides `search_query`) |
| `results_wanted` | Integer | No | `20` | Maximum number of products to collect (0 = unlimited) |
| `proxyConfiguration` | Object | No | Residential | Proxy settings for reliable scraping |
| `setGeolocation` | Boolean | No | `true` | Set a fixed geolocation to help Blinkit load products for a delivery area |
| `latitude` | Number | No | `28.6139` | Latitude used when `setGeolocation` is enabled |
| `longitude` | Number | No | `77.2090` | Longitude used when `setGeolocation` is enabled |

---

## Output Data
Each product in the dataset contains:

| Field | Type | Description |
|-------|------|-------------|
| `product_name` | String | Name of the product |
| `product_id` | String/Number | Product identifier (when available) |
| `sku_id` | String/Number | SKU / variant identifier (when available) |
| `brand` | String | Brand name (when available) |
| `quantity` | String/Number | Quantity (when available) |
| `unit` | String | Unit / size label (when available) |
| `price` | Number | Current price in INR (₹) |
| `original_price` | Number | Original price before discount (when available) |
| `discount_percentage` | String | Discount label (e.g., "14% OFF") |
| `rating` | Number | Rating value (when available) |
| `ratings_count` | Number | Ratings / reviews count (when available) |
| `inventory` | Number | Inventory/stock count signal (when available) |
| `product_image` | String | URL of the product image |
| `availability` | String | Stock status (In Stock, Out of Stock, Unknown) |
| `delivery_time` | String | Estimated delivery time (when available) |
| `product_url` | String | Product page URL (when available) |
| `search_query` | String | Search keyword used |
| `url` | String | Search URL |
| `scrapedAt` | String | Timestamp when data was scraped |

Note: Optional fields are omitted from the output when they are not available.

---

## Usage Examples

### Search for Milk Products

```json
{
    "search_query": "milk",
    "results_wanted": 20,
    "setGeolocation": true,
    "latitude": 28.6139,
    "longitude": 77.209
}
```

### Search via URL

```json
{
    "search_url": "https://blinkit.com/s/?q=milk",
    "results_wanted": 20
}
```

Note: If `search_url` includes `lat`/`lng` (or `latitude`/`longitude`) query parameters, those values override `latitude`/`longitude` when `setGeolocation` is enabled.

### Search for Vegetables

```json
{
    "search_query": "vegetables",
    "results_wanted": 50
}
```

### Unlimited Results

```json
{
    "search_query": "snacks",
    "results_wanted": 0
}
```

### Larger Collection

```json
{
    "search_query": "milk",
    "results_wanted": 200,
    "setGeolocation": true,
    "latitude": 28.6139,
    "longitude": 77.209
}
```

### Custom Proxy Configuration

```json
{
    "search_query": "fruits",
    "results_wanted": 30,
    "proxyConfiguration": {
        "useApifyProxy": true,
        "apifyProxyGroups": ["RESIDENTIAL"]
    }
}
```

---

## Sample Output

```json
{
    "product_name": "Country Delight Buffalo Fresh Milk",
    "product_id": 637879,
    "brand": "Country Delight",
    "quantity": 1,
    "unit": "450 ml",
    "price": 51,
    "original_price": 59,
    "discount_percentage": "14% OFF",
    "inventory": 1,
    "availability": "In Stock",
    "product_image": "https://cdn.grofers.com/da/cms-assets/cms/product/6e7eba87-a136-409a-9aab-7022ca4051be.png",
    "product_url": "https://blinkit.com/prn/country-delight-buffalo-fresh-milk/prid/637879",
    "search_query": "milk",
    "url": "https://blinkit.com/s/?q=milk",
    "scrapedAt": "2026-02-17T07:11:34.570Z"
}
```

---

## Tips for Best Results

### Choose Specific Keywords
- Use specific product names for better results (e.g., "paneer" instead of "dairy")
- Try brand names for targeted scraping (e.g., "amul milk")
- Test different keywords to find optimal search terms

### Optimize Result Limits
- Start with 20-50 products for testing
- Use 0 for unlimited to scrape all available products
- Consider rate limits and processing time for large scrapes

### Use Residential Proxies
- Enable residential proxies for best reliability
### Set a Delivery Location
- If you see empty results, enable `setGeolocation` and provide `latitude`/`longitude` for a delivery area

### Use Proxies
- Residential proxies recommended for Blinkit
- Prevents IP blocks and rate limiting
- Ensures consistent data extraction

---

## Integrations

Connect your Blinkit pricing data with:

- **Google Sheets** — Export for price tracking and analysis
- **Airtable** — Build searchable product databases
- **Slack** — Get notifications on price changes
- **Webhooks** — Send data to custom applications
- **Make** — Create automated pricing workflows
- **Zapier** — Trigger actions based on price updates

### Export Formats

Download data in multiple formats:

- **JSON** — For developers and API integrations
- **CSV** — For spreadsheet analysis and reporting
- **Excel** — For business intelligence dashboards
- **XML** — For system integrations and feeds

---

## Frequently Asked Questions

### How many products can I scrape?
Set `results_wanted` to 0 for unlimited products, or specify a number. The limit depends on available products and your Apify plan.

### What categories can I search?
You can search for any product category available on Blinkit: groceries, vegetables, fruits, dairy, snacks, beverages, etc.

### Does the scraper work in all locations?
Blinkit serves specific delivery areas. Product availability and prices may vary by location detected by the platform.

### How often should I run the scraper?
For price monitoring, run hourly or daily. For market research, weekly runs may suffice depending on your needs.

### Can I track price changes over time?
Yes, run the scraper regularly and compare datasets to track pricing trends and discount patterns.

### Is the data real-time?
Data reflects Blinkit.com at the time of scraping. Prices and availability update frequently, so run regularly for current data.

### What proxy settings should I use?
Residential proxies provide the best reliability for Blinkit scraping. They're configured by default in the `proxyConfiguration` parameter.

---

## Support

For issues or feature requests, contact support through the Apify Console.

### Resources

- [Apify Documentation](https://docs.apify.com/)
- [API Reference](https://docs.apify.com/api/v2)
- [Scheduling Runs](https://docs.apify.com/schedules)

---

## Legal Notice

This actor is designed for legitimate data collection purposes. Users are responsible for ensuring compliance with Blinkit's terms of service and applicable laws. Use data responsibly and respect rate limits.
