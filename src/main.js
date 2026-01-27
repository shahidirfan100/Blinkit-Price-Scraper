// Blinkit Price Scraper - Extract product prices, names, and availability from Blinkit
import { PlaywrightCrawler, Dataset } from 'crawlee';
import { Actor, log } from 'apify';

await Actor.init();

const PRODUCT_KEYS = {
    name: ['name', 'product_name', 'title', 'productName', 'display_name', 'displayName', 'item_name'],
    price: ['price', 'selling_price', 'offer_price', 'discounted_price', 'final_price', 'sp', 'sale_price', 'unit_price'],
    originalPrice: ['mrp', 'original_price', 'list_price', 'mrp_price'],
    discount: ['discount', 'discount_text', 'discount_percentage', 'discountPercent', 'offer_text'],
    image: ['image', 'image_url', 'imageUrl', 'thumbnail', 'img', 'picture', 'product_image'],
    availability: ['in_stock', 'available', 'availability', 'stock'],
    delivery: ['eta', 'delivery_time', 'deliveryTime'],
    url: ['product_url', 'productUrl', 'url', 'slug'],
};

const pickFirst = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return null;
};

const toNumber = (value) => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value).trim();
    if (!str) return null;
    const cleaned = str.replace(/[^\d.]/g, '');
    if (!cleaned) return null;
    const num = Number.parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
};

const extractImage = (obj) => {
    const direct = pickFirst(obj, PRODUCT_KEYS.image);
    if (typeof direct === 'string') return direct;
    if (direct && typeof direct === 'object') {
        const nested = pickFirst(direct, ['url', 'src', 'image', 'imageUrl']);
        if (typeof nested === 'string') return nested;
    }
    const images = obj?.images || obj?.image_urls || obj?.imageUrls;
    if (Array.isArray(images) && images.length > 0) {
        const first = images[0];
        if (typeof first === 'string') return first;
        if (first && typeof first === 'object') {
            const nested = pickFirst(first, ['url', 'src', 'image', 'imageUrl']);
            if (typeof nested === 'string') return nested;
        }
    }
    return null;
};

const extractPrice = (obj) => {
    let value = pickFirst(obj, PRODUCT_KEYS.price);
    if (value && typeof value === 'object') {
        value = pickFirst(value, ['selling_price', 'offer_price', 'price', 'final_price', 'mrp', 'list_price']);
    }
    return toNumber(value);
};

const extractOriginalPrice = (obj) => {
    let value = pickFirst(obj, PRODUCT_KEYS.originalPrice);
    if (value && typeof value === 'object') {
        value = pickFirst(value, ['mrp', 'list_price', 'original_price']);
    }
    return toNumber(value);
};

const extractName = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.name);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
};

const extractAvailability = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.availability);
    if (typeof value === 'boolean') return value ? 'In Stock' : 'Out of Stock';
    if (typeof value === 'string') {
        const lowered = value.toLowerCase();
        if (lowered.includes('out')) return 'Out of Stock';
        if (lowered.includes('in')) return 'In Stock';
    }
    return null;
};

const extractDelivery = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.delivery);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
};

const extractDiscount = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.discount);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return `${value}%`;
    return null;
};

const scoreProduct = (obj) => {
    let score = 0;
    if (extractName(obj)) score += 2;
    if (extractPrice(obj) !== null) score += 2;
    if (extractOriginalPrice(obj) !== null) score += 1;
    if (extractImage(obj)) score += 1;
    if (extractAvailability(obj)) score += 1;
    return score;
};

const findProductArrays = (root) => {
    const candidates = [];
    const seen = new Set();

    const walk = (node, depth = 0) => {
        if (!node || typeof node !== 'object') return;
        if (seen.has(node) || depth > 7) return;
        seen.add(node);

        if (Array.isArray(node)) {
            if (node.length > 0 && node.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
                const sample = node.slice(0, Math.min(25, node.length));
                const avgScore = sample.reduce((sum, item) => sum + scoreProduct(item), 0) / sample.length;
                if (avgScore >= 3) {
                    candidates.push({ items: node, score: avgScore, size: node.length });
                }
            }
            for (const item of node) walk(item, depth + 1);
            return;
        }

        for (const key of Object.keys(node)) {
            walk(node[key], depth + 1);
        }
    };

    walk(root, 0);
    if (candidates.length === 0) return null;

    candidates.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return b.size - a.size;
    });

    return candidates[0].items;
};

const normalizeProduct = (raw) => {
    const base = raw && typeof raw === 'object' && raw.product && typeof raw.product === 'object'
        ? raw.product
        : raw;

    const productName = extractName(base) || extractName(raw);
    const price = extractPrice(base) ?? extractPrice(raw);
    const originalPrice = extractOriginalPrice(base) ?? extractOriginalPrice(raw);
    const discount = extractDiscount(base) ?? extractDiscount(raw);
    const image = extractImage(base) ?? extractImage(raw);
    const availability = extractAvailability(base) ?? extractAvailability(raw);
    const delivery = extractDelivery(base) ?? extractDelivery(raw);
    const productUrl = pickFirst(base, PRODUCT_KEYS.url) || pickFirst(raw, PRODUCT_KEYS.url) || null;

    return {
        product_name: productName,
        price,
        original_price: originalPrice,
        discount_percentage: discount,
        product_image: image,
        availability: availability || 'Unknown',
        delivery_time: delivery,
        product_url: typeof productUrl === 'string' ? productUrl : null,
    };
};

const extractProductsFromPayloads = (payloads = []) => {
    const allProducts = [];
    for (const payload of payloads) {
        if (!payload || typeof payload !== 'object') continue;

        // 1. Try Blinkit specific widget structure (highest priority)
        if (Array.isArray(payload.widgets)) {
            for (const widget of payload.widgets) {
                if ((widget.type === 'listing_container' || widget.type === 'product_grid') && 
                    widget.data && Array.isArray(widget.data.objects)) {
                    allProducts.push(...widget.data.objects.map(normalizeProduct));
                }
            }
        }
        
        // 2. Fallback to generic array discovery if specific structure didn't find much
        if (allProducts.length === 0) {
            const items = findProductArrays(payload);
            if (items && items.length > 0) {
                allProducts.push(...items.map(normalizeProduct));
            }
        }
    }

    // Deduplicate by name if needed, but usually not necessary for a single page
    return allProducts.filter(p => p && p.product_name);
};

async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            search_query = '',
            search_url = '',
            results_wanted: RESULTS_WANTED_RAW = 20,
            proxyConfiguration: proxyConfig,
            latitude,
            longitude,
            setGeolocation = true,
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) && +RESULTS_WANTED_RAW > 0 
            ? +RESULTS_WANTED_RAW 
            : 0; // 0 means unlimited

        const searchUrlInput = typeof search_url === 'string' ? search_url.trim() : '';
        const searchQueryInput = typeof search_query === 'string' ? search_query.trim() : '';
        let finalSearchUrl = '';
        let effectiveQuery = searchQueryInput;
        let geoLatitude = Number.isFinite(+latitude) ? Number(latitude) : null;
        let geoLongitude = Number.isFinite(+longitude) ? Number(longitude) : null;

        if (searchUrlInput) {
            if (!/^https?:\/\//i.test(searchUrlInput)) {
                throw new Error('search_url must start with http:// or https://');
            }
            finalSearchUrl = searchUrlInput;
            effectiveQuery = '';
            try {
                const url = new URL(searchUrlInput);
                effectiveQuery = url.searchParams.get('q') || url.searchParams.get('query') || '';
                const latParam = url.searchParams.get('lat') || url.searchParams.get('latitude');
                const lngParam = url.searchParams.get('lng') || url.searchParams.get('lon') || url.searchParams.get('longitude');
                const parsedLat = latParam !== null ? Number(latParam) : null;
                const parsedLng = lngParam !== null ? Number(lngParam) : null;
                if (Number.isFinite(parsedLat) && Number.isFinite(parsedLng)) {
                    geoLatitude = parsedLat;
                    geoLongitude = parsedLng;
                    log.info(`Geolocation derived from search_url: ${geoLatitude}, ${geoLongitude}`);
                }
            } catch {
                // Ignore URL parsing errors, still use raw URL
            }
        } else if (searchQueryInput) {
            finalSearchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(searchQueryInput)}`;
        } else {
            throw new Error('Provide search_query or search_url');
        }

        const searchQueryForOutput = effectiveQuery || '';

        log.info(`Starting Blinkit scraper for query: "${searchQueryForOutput || 'N/A'}"`);
        log.info(`Target results: ${RESULTS_WANTED === 0 ? 'unlimited' : RESULTS_WANTED}`);

        // Construct search URL
        log.info(`Search URL: ${finalSearchUrl}`);

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
                    if (setGeolocation) {
                        try {
                            if (Number.isFinite(geoLatitude) && Number.isFinite(geoLongitude)) {
                                await page.context().grantPermissions(['geolocation']);
                                await page.context().setGeolocation({
                                    latitude: Number(geoLatitude),
                                    longitude: Number(geoLongitude),
                                });
                                log.info(`Geolocation set to ${geoLatitude}, ${geoLongitude}`);
                            } else {
                                log.warning('Geolocation enabled but latitude/longitude are missing or invalid.');
                            }
                        } catch (error) {
                            log.warning('Failed to set geolocation');
                        }
                    }

                    // Add realistic headers and Blinkit specific markers
                    await page.setExtraHTTPHeaders({
                        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                        'accept-language': 'en-US,en;q=0.9',
                        'accept-encoding': 'gzip, deflate, br',
                        'sec-fetch-dest': 'document',
                        'sec-fetch-mode': 'navigate',
                        'sec-fetch-site': 'none',
                        'upgrade-insecure-requests': '1',
                        'app_client': 'web',
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
                    const responsePayloads = [];
                    const responseUrls = new Set();

                    const responseListener = async (response) => {
                        const url = response.url();
                        const contentType = response.headers()['content-type'] || '';
                        if (!contentType.includes('application/json')) return;
                        if (!/search|catalog|product|listing|plp|collection|browse|autocomplete|autosuggest|items|v\\d+/i.test(url)) {
                            return;
                        }
                        if (responseUrls.has(url)) return;
                        try {
                            const json = await response.json();
                            responsePayloads.push(json);
                            responseUrls.add(url);
                        } catch {
                            // Ignore non-JSON or unreadable responses
                        }
                    };

                    page.on('response', responseListener);

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

                    // PRIORITY 0: Try to extract window.grofers.PRELOADED_STATE
                    log.info('Checking for PRELOADED_STATE...');
                    const preloadedState = await page.evaluate(() => {
                        return window.grofers?.PRELOADED_STATE || null;
                    });

                    if (preloadedState) {
                        const extracted = extractProductsFromPayloads([preloadedState]);
                        if (extracted.length > 0) {
                            log.info(`Found ${extracted.length} products in PRELOADED_STATE`);
                            const limit = RESULTS_WANTED > 0 ? RESULTS_WANTED : extracted.length;
                            const limitedProducts = extracted.slice(0, limit).map(p => ({
                                ...p,
                                search_query: searchQueryForOutput,
                                url: request.url,
                                scrapedAt: new Date().toISOString(),
                            }));

                            await Dataset.pushData(limitedProducts);
                            totalScraped += limitedProducts.length;
                            log.info(`Extracted ${limitedProducts.length} products from PRELOADED_STATE`);
                            if (totalScraped >= RESULTS_WANTED && RESULTS_WANTED > 0) return;
                        }
                    }

                    // PRIORITY 1: Try to extract __NEXT_DATA__ (Next.js)
                    log.info('Checking for __NEXT_DATA__...');
                    const nextDataProducts = await page.evaluate(() => {
                        try {
                            const nextDataScript = document.getElementById('__NEXT_DATA__');
                            if (nextDataScript) {
                                const json = JSON.parse(nextDataScript.textContent);
                                return json || null;
                            }
                        } catch (e) {
                            console.log('__NEXT_DATA__ extraction failed:', e);
                        }
                        return null;
                    });

                    if (nextDataProducts) {
                        const extracted = extractProductsFromPayloads([nextDataProducts]);
                        if (extracted.length > 0) {
                            log.info(`Found ${extracted.length} products in __NEXT_DATA__ payload`);
                            const limit = RESULTS_WANTED > 0 ? RESULTS_WANTED : extracted.length;
                            const limitedProducts = extracted.slice(0, limit).map(p => ({
                                ...p,
                                search_query: searchQueryForOutput,
                                url: request.url,
                                scrapedAt: new Date().toISOString(),
                            }));

                            await Dataset.pushData(limitedProducts);
                            totalScraped += limitedProducts.length;
                            log.info(`Extracted ${limitedProducts.length} products from __NEXT_DATA__`);
                            if (totalScraped >= RESULTS_WANTED && RESULTS_WANTED > 0) return;
                        }
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

                    // PRIORITY 3: Try captured JSON responses
                    const networkProducts = extractProductsFromPayloads(responsePayloads);
                    if (networkProducts.length > 0) {
                        const limit = RESULTS_WANTED > 0 ? RESULTS_WANTED : networkProducts.length;
                        const limitedProducts = networkProducts.slice(0, limit).map(p => ({
                            ...p,
                            search_query: searchQueryForOutput,
                            url: request.url,
                            scrapedAt: new Date().toISOString(),
                        }));

                        await Dataset.pushData(limitedProducts);
                        totalScraped += limitedProducts.length;
                        log.info(`Extracted ${limitedProducts.length} products from network JSON`);
                        return;
                    }

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
                        log.warning('If results are empty, Blinkit may require a delivery location. Consider enabling setGeolocation with latitude/longitude.');
                        await Actor.setValue('debug-no-products', await page.content(), { contentType: 'text/html' });
                        await Actor.setValue('debug-response-urls', JSON.stringify(Array.from(responseUrls), null, 2), { contentType: 'application/json' });
                        return;
                    }

                    // Add search query and URL to each product
                    const enrichedProducts = products.map(p => ({
                        ...p,
                        search_query: searchQueryForOutput,
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
        await crawler.run([{ url: finalSearchUrl }]);

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
