// Blinkit Price Scraper - Extract product prices, names, and availability from Blinkit
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor, log } from 'apify';

await Actor.init();

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            search_query = 'milk',
            results_wanted: RESULTS_WANTED_RAW = 20,
            proxyConfiguration: proxyConfig,
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) && +RESULTS_WANTED_RAW > 0 
            ? +RESULTS_WANTED_RAW 
            : 0; // 0 means unlimited

        log.info(`Starting Blinkit scraper for query: "${search_query}"`);
        log.info(`Target results: ${RESULTS_WANTED === 0 ? 'unlimited' : RESULTS_WANTED}`);

        // Construct search URL
        const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(search_query)}`;
        log.info(`Search URL: ${searchUrl}`);

        // Validate input
        if (!search_query || search_query.trim().length === 0) {
            throw new Error('search_query is required and cannot be empty');
        }

        // Create proxy configuration (residential recommended for Blinkit)
        const proxyConfiguration = await Actor.createProxyConfiguration(proxyConfig || {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
        });

        // Product selectors for Blinkit (multiple fallback options)
        const SELECTORS = {
            productContainer: [
                'div[class*="Product__"]',
                '[data-testid="product"]',
                'article[class*="product"]',
                'div[class*="ProductCard"]'
            ],
            productName: [
                'div[class*="Product__ProductName"]',
                '[data-testid="product-name"]',
                'h3[class*="product-name"]',
                'div[class*="ProductName"]'
            ],
            currentPrice: [
                'div[class*="Product__UpdatedPrice"]',
                '[data-testid="product-price"]',
                'span[class*="price"]',
                'div[class*="Price"]'
            ],
            originalPrice: [
                'div[class*="Product__MrpText"]',
                '[data-testid="original-price"]',
                'span[class*="mrp"]',
                'del[class*="price"]'
            ],
            discount: [
                'div[class*="Product__UpdatedDiscountPercent"]',
                '[data-testid="discount"]',
                'span[class*="discount"]'
            ],
            productImage: [
                'img[class*="Product__ProductImage"]',
                '[data-testid="product-image"]',
                'img[class*="product-img"]'
            ],
            addButton: [
                'div[class*="Product__AddToCart"]',
                'button[class*="add-to-cart"]',
                '[data-testid="add-button"]'
            ],
            outOfStock: [
                'div[class*="OutOfStock"]',
                '[data-testid="out-of-stock"]',
                'span[class*="out-of-stock"]'
            ],
            deliveryTime: [
                'div[class*="eta-"]',
                '[data-testid="delivery-time"]',
                'span[class*="delivery"]'
            ],
        };

        let totalScraped = 0;

        // Helper function to try multiple selectors
        const findElement = (page, selectors) => {
            for (const selector of selectors) {
                const element = page.locator(selector).first();
                if (element) return element;
            }
            return null;
        };

        // Create Playwright crawler
        const crawler = new PlaywrightCrawler({
            proxyConfiguration,
            maxRequestRetries: 5,
            maxConcurrency: 2, // Lower for better stealth
            requestHandlerTimeoutSecs: 180,
            navigationTimeoutSecs: 60,
            useSessionPool: true, // Better session management
            sessionPoolOptions: {
                maxPoolSize: 50,
                sessionOptions: {
                    maxUsageCount: 10,
                    maxErrorScore: 3,
                },
            },

            // Browser configuration with fingerprints for stealth
            browserPoolOptions: {
                useFingerprints: true,
                fingerprintOptions: {
                    fingerprintGeneratorOptions: {
                        browsers: ['chrome', 'firefox'],
                        operatingSystems: ['windows', 'macos'],
                        devices: ['desktop'],
                    },
                },
            },

            // Pre-navigation hooks for stealth
            preNavigationHooks: [
                async ({ page, request }) => {
                    // Add realistic headers
                    await page.setExtraHTTPHeaders({
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                        'sec-fetch-dest': 'document',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-site': 'none',
                        'upgrade-insecure-requests': '1',
                    });

                    // Human-like delay before navigation
                    await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));

                    // Block heavy resources for better performance
                    await page.route('**/*', (route) => {
                        const type = route.request().resourceType();
                        const url = route.request().url();

                        // Block fonts, media, and trackers
                        if (['font', 'media'].includes(type) ||
                            url.includes('google-analytics') ||
                            url.includes('googletagmanager') ||
                            url.includes('facebook.com') ||
                            url.includes('doubleclick.net') ||
                            url.includes('hotjar')) {
                            return route.abort();
                        }
                        return route.continue();
                    });

                    // Stealth configurations
                    await page.addInitScript(() => {
                        // Hide webdriver
                        Object.defineProperty(navigator, 'webdriver', { 
                            get: () => false,
                            configurable: true 
                        });
                        
                        // Add chrome object
                        window.chrome = { 
                            runtime: {},
                            loadTimes: () => {},
                            csi: () => {},
                            app: {}
                        };
                        
                        // Add realistic plugins
                        Object.defineProperty(navigator, 'plugins', { 
                            get: () => [1, 2, 3, 4, 5],
                            configurable: true 
                        });
                        
                        // Add realistic languages
                        Object.defineProperty(navigator, 'languages', { 
                            get: () => ['en-US', 'en'],
                            configurable: true 
                        });

                        // Override permissions
                        const originalQuery = window.navigator.permissions.query;
                        window.navigator.permissions.query = (parameters) => (
                            parameters.name === 'notifications' ?
                                Promise.resolve({ state: Notification.permission }) :
                                originalQuery(parameters)
                        );
                    });
                },
            ],

            async requestHandler({ page, request }) {
                log.info(`Processing: ${request.url}`);

                try {
                    // Wait for page to load
                    await page.waitForLoadState('domcontentloaded');
                    
                    // Check for blocking
                    const title = await page.title();
                    log.info(`Page title: ${title}`);
                    
                    if (title.includes('Access Denied') || 
                        title.includes('Captcha') || 
                        title.includes('Robot') ||
                        title.includes('Blocked')) {
                        log.error('Page blocked! Need better proxies or stealth');
                        await Actor.setValue('blocked-page', await page.content(), { contentType: 'text/html' });
                        return;
                    }

                    // Wait for dynamic content with timeout
                    await page.waitForTimeout(3000);

                    // PRIORITY 1: Try to extract __NEXT_DATA__ (Next.js)
                    log.info('Checking for __NEXT_DATA__...');
                    const nextDataProducts = await page.evaluate(() => {
                        try {
                            const nextDataScript = document.getElementById('__NEXT_DATA__');
                            if (nextDataScript) {
                                const json = JSON.parse(nextDataScript.textContent);
                                // Navigate the JSON structure to find products
                                // Blinkit likely uses Next.js, products might be in props
                                const products = json?.props?.pageProps?.initialState?.products ||
                                               json?.props?.pageProps?.products ||
                                               json?.props?.products ||
                                               [];
                                return products.length > 0 ? products : null;
                            }
                        } catch (e) {
                            console.log('__NEXT_DATA__ extraction failed:', e);
                        }
                        return null;
                    });

                    if (nextDataProducts && nextDataProducts.length > 0) {
                        log.info(`Found ${nextDataProducts.length} products in __NEXT_DATA__`);
                        const products = nextDataProducts.map(p => ({
                            product_name: p.name || p.product_name || p.title || null,
                            price: p.price || p.offer_price || p.selling_price || null,
                            original_price: p.mrp || p.original_price || p.list_price || null,
                            discount_percentage: p.discount_text || p.discount || null,
                            product_image: p.image_url || p.image || p.thumbnail || null,
                            availability: p.in_stock ? 'In Stock' : 'Out of Stock',
                            delivery_time: p.eta || p.delivery_time || null,
                            search_query: search_query,
                            url: request.url,
                            scrapedAt: new Date().toISOString()
                        }));
                        
                        const limit = RESULTS_WANTED > 0 ? RESULTS_WANTED : products.length;
                        const limitedProducts = products.slice(0, limit);
                        
                        await Dataset.pushData(limitedProducts);
                        totalScraped += limitedProducts.length;
                        log.info(`Extracted ${limitedProducts.length} products from __NEXT_DATA__`);
                        return;
                    }

                    // PRIORITY 2: Scroll to load all products
                    log.info('Scrolling to load all products...');
                    let previousHeight = 0;
                    let scrollAttempts = 0;
                    const maxScrollAttempts = 20;

                    while (scrollAttempts < maxScrollAttempts) {
                        // Check if we have enough products
                        if (RESULTS_WANTED > 0) {
                            const currentProductCount = await page.locator(SELECTORS.productContainer[0]).count();
                            if (currentProductCount >= RESULTS_WANTED) {
                                log.info(`Reached target product count (${currentProductCount} >= ${RESULTS_WANTED})`);
                                break;
                            }
                        }

                        // Scroll down with human-like behavior
                        await page.evaluate(() => {
                            window.scrollBy(0, window.innerHeight * 0.8);
                        });
                        await page.waitForTimeout(1000 + Math.random() * 1000);

                        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                        if (currentHeight === previousHeight) {
                            log.info('Reached end of page');
                            break;
                        }
                        previousHeight = currentHeight;
                        scrollAttempts++;
                    }

                    log.info('Extracting product data from HTML...');

                    // PRIORITY 3: Extract using browser context with fallback selectors
                    const products = await page.evaluate(({ selectors, resultsWanted }) => {
                        // Helper to try multiple selectors
                        const findWithSelectors = (element, selectorArray) => {
                            for (const selector of selectorArray) {
                                const found = element.querySelector(selector);
                                if (found) return found;
                            }
                            return null;
                        };

                        // Find all product containers
                        let productElements = [];
                        for (const containerSelector of selectors.productContainer) {
                            productElements = Array.from(document.querySelectorAll(containerSelector));
                            if (productElements.length > 0) {
                                console.log(`Found ${productElements.length} products with selector: ${containerSelector}`);
                                break;
                            }
                        }

                        if (productElements.length === 0) {
                            console.log('No products found with any selector');
                            return [];
                        }

                        const limit = resultsWanted > 0 ? resultsWanted : productElements.length;

                        return productElements.slice(0, limit).map(el => {
                            // Extract product name
                            const nameEl = findWithSelectors(el, selectors.productName);
                            const productName = nameEl ? nameEl.textContent.trim() : null;

                            // Extract current price
                            const priceEl = findWithSelectors(el, selectors.currentPrice);
                            let currentPrice = null;
                            if (priceEl) {
                                const priceText = priceEl.textContent.trim().replace(/[₹,\s]/g, '');
                                currentPrice = parseFloat(priceText) || null;
                            }

                            // Extract original price (if discounted)
                            const originalPriceEl = findWithSelectors(el, selectors.originalPrice);
                            let originalPrice = null;
                            if (originalPriceEl) {
                                const originalPriceText = originalPriceEl.textContent.trim().replace(/[₹,\s]/g, '');
                                originalPrice = parseFloat(originalPriceText) || null;
                            }

                            // Extract discount percentage
                            const discountEl = findWithSelectors(el, selectors.discount);
                            const discountPercentage = discountEl ? discountEl.textContent.trim() : null;

                            // Extract product image
                            const imageEl = findWithSelectors(el, selectors.productImage);
                            const productImage = imageEl ? (imageEl.src || imageEl.getAttribute('src')) : null;

                            // Check availability
                            const outOfStockEl = findWithSelectors(el, selectors.outOfStock);
                            const addButtonEl = findWithSelectors(el, selectors.addButton);
                            const availability = outOfStockEl ? 'Out of Stock' : 
                                               (addButtonEl ? 'In Stock' : 'Unknown');

                            // Extract delivery time (global or per-product)
                            const deliveryTimeEl = findWithSelectors(el, selectors.deliveryTime) || 
                                                  findWithSelectors(document, selectors.deliveryTime);
                            const deliveryTime = deliveryTimeEl ? deliveryTimeEl.textContent.trim() : null;

                            return {
                                product_name: productName,
                                price: currentPrice,
                                original_price: originalPrice,
                                discount_percentage: discountPercentage,
                                product_image: productImage,
                                availability: availability,
                                delivery_time: deliveryTime,
                                scrapedAt: new Date().toISOString()
                            };
                        }).filter(p => p.product_name && p.product_name.length > 0); // Filter out invalid entries
                    }, { selectors: SELECTORS, resultsWanted: RESULTS_WANTED });

                    // Validate extraction
                    if (products.length === 0) {
                        log.warning('No products extracted! Saving debug HTML for inspection...');
                        await Actor.setValue('debug-no-products', await page.content(), { contentType: 'text/html' });
                        return;
                    }

                    // Add search query and URL to each product
                    const enrichedProducts = products.map(p => ({
                        ...p,
                        search_query: search_query,
                        url: request.url
                    }));

                    log.info(`Extracted ${enrichedProducts.length} products`);
                    totalScraped += enrichedProducts.length;

                    // Save to dataset
                    if (enrichedProducts.length > 0) {
                        await Dataset.pushData(enrichedProducts);
                    }

                } catch (error) {
                    log.exception(error, `Error processing ${request.url}`);
                    // Save error page for debugging
                    try {
                        await Actor.setValue(`error-${Date.now()}`, await page.content(), { contentType: 'text/html' });
                    } catch (saveError) {
                        log.warning('Failed to save error page');
                    }
                    throw error;
                }
            },
        });

        // Run crawler
        await crawler.run([{ url: searchUrl }]);

        log.info(`✅ Scraping completed! Total products scraped: ${totalScraped}`);

    } catch (error) {
        log.exception(error, 'Actor failed');
        throw error;
    } finally {
        await Actor.exit();
    }
}

main().catch(err => {
    log.exception(err, 'Actor failed with unhandled error');
    process.exit(1);
});
