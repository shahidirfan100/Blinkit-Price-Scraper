# Blinkit Price Scraper

Extract product prices, names, discounts, and availability from Blinkit grocery delivery service. Perfect for price tracking, market research, and monitoring product availability across different locations.

## Features

- **Comprehensive Product Data** — Extract product names, prices, discounts, images, and availability status
- **Real-Time Pricing** — Track current prices, original prices, and discount percentages
- **Search-Based Scraping** — Search for any product category (milk, vegetables, snacks, etc.)
- **Production-Ready** — Uses Playwright with stealth features for reliable data extraction
- **Structured Output** — Clean, organized product data ready for analysis and price comparison

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
| `results_wanted` | Integer | No | `20` | Maximum number of products to collect (0 = unlimited) |
| `proxyConfiguration` | Object | No | Residential | Proxy settings for reliable scraping |

---

## Data Extraction Methods

The scraper uses Playwright browser automation for reliable data extraction:

This ensures comprehensive review collection even when page structures change. |

---
## Output Data

1. **Browser Automation** — Uses Playwright with Chrome fingerprinting for dynamic content
2. **Stealth Features** — Anti-detection measures to avoid blocks
3. **Smart Scrolling** — Automatically scrolls to load all products
4. **Resource Blocking** — Blocks unnecessary resources for faster scraping

Each product in the dataset contains:

| Field | Type | Description |
|-------|------|-------------|
| `product_name` | String | Name of the product |
| `price` | Number | Current price in INR (₹) |
| `original_price` | Number | Original price before discount (if applicable) |
| `discount_percentage` | String | Discount percentage (e.g., "8% OFF") |
| `product_image` | String | URL of the product image |
| `availability` | String | Stock status (In Stock, Out of Stock, Unknown) |
| `delivery_time` | String | Estimated delivery time (e.g., "13 MINS") |
| `search_query` | String | Search keyword used |
| `url` | String | Search URL |
| `scrapedAt` | String | Timestamp when data was scraped |

---

## Usage Examples

### Search for Milk Products

```json
{
    "search_query": "milk",
    "results_wanted": 20
}
```

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
    "product_name": "Amul Taaza Toned Milk 500 ml",
    "price": 29,
    "original_price": null,
    "discount_percentage": null,
    "product_image": "https://cdn.grofers.com/cdn-cgi/image/f=auto,fit=scale-down,q=70,metadata=none,w=900/da/cms-assets/cms/product/5734b087-3ad9-485f-bbe2-52079cd9e35d.png",
    "availability": "In Stock",
    "delivery_time": "13 MINS",
    "search_query": "milk",
    "url": "https://blinkit.com/s/?q=milk",
    "scrapedAt": "2026-01-27T10:30:00.000Z"
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
