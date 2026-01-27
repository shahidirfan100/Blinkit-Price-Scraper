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
    id: ['product_id', 'productId', 'id', 'sku', 'sku_id', 'item_id', 'variant_id'],
};

/**
 * Pick the first defined value from an object using a list of keys.
 * @param {Object|null} obj - Source object.
 * @param {string[]} keys - Keys to check in order.
 * @returns {*|null} First defined value or null.
 */
const pickFirst = (obj, keys) => {
    if (!obj || typeof obj !== 'object') return null;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, key) && obj[key] !== undefined && obj[key] !== null) {
            return obj[key];
        }
    }
    return null;
};

/**
 * Convert a value to a number if possible.
 * @param {*} value - Input value.
 * @returns {number|null} Parsed number or null.
 */
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

/**
 * Extract a product image URL from a product-like object.
 * @param {Object|null} obj - Product-like object.
 * @returns {string|null} Image URL or null.
 */
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

/**
 * Extract product ID from a product-like object.
 * @param {Object|null} obj - Product-like object.
 * @returns {string|number|null} Product ID or null.
 */
const extractProductId = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.id);
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value).trim();
    return str ? str : null;
};

/**
 * Extract selling price from a product-like object.
 * @param {Object|null} obj - Product-like object.
 * @returns {number|null} Price or null.
 */
const extractPrice = (obj) => {
    let value = pickFirst(obj, PRODUCT_KEYS.price);
    if (value && typeof value === 'object') {
        value = pickFirst(value, ['selling_price', 'offer_price', 'price', 'final_price', 'mrp', 'list_price']);
    }
    return toNumber(value);
};

/**
 * Extract original/MRP price from a product-like object.
 * @param {Object|null} obj - Product-like object.
 * @returns {number|null} Original price or null.
 */
const extractOriginalPrice = (obj) => {
    let value = pickFirst(obj, PRODUCT_KEYS.originalPrice);
    if (value && typeof value === 'object') {
        value = pickFirst(value, ['mrp', 'list_price', 'original_price']);
    }
    return toNumber(value);
};

/**
 * Extract a product name.
 * @param {Object|null} obj - Product-like object.
 * @returns {string|null} Product name or null.
 */
const extractName = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.name);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
};

/**
 * Normalize availability to "In Stock"/"Out of Stock".
 * @param {Object|null} obj - Product-like object.
 * @returns {string|null} Availability or null.
 */
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

/**
 * Extract delivery time label.
 * @param {Object|null} obj - Product-like object.
 * @returns {string|null} Delivery label or null.
 */
const extractDelivery = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.delivery);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    return String(value).trim();
};

/**
 * Extract discount label or percentage.
 * @param {Object|null} obj - Product-like object.
 * @returns {string|null} Discount label or null.
 */
const extractDiscount = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.discount);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number') return `${value}%`;
    return null;
};

/**
 * Normalize a raw product-like object to a consistent schema.
 * @param {Object|null} raw - Raw product object.
 * @returns {Object} Normalized product object.
 */
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
    const productUrlRaw = pickFirst(base, PRODUCT_KEYS.url) || pickFirst(raw, PRODUCT_KEYS.url) || null;
    const productId = extractProductId(base) ?? extractProductId(raw);

    let productUrl = null;
    if (typeof productUrlRaw === 'string' && productUrlRaw.trim()) {
        const trimmed = productUrlRaw.trim();
        if (trimmed.startsWith('http')) {
            productUrl = trimmed;
        } else {
            const path = trimmed.replace(/^\//, '');
            if (path.startsWith('prn/') || path.includes('/prn/')) {
                productUrl = `https://blinkit.com/${path}`;
            } else if (productId) {
                productUrl = `https://blinkit.com/prn/${path}/prid/${productId}`;
            } else {
                productUrl = `https://blinkit.com/${path}`;
            }
        }
    } else if (productId && productName) {
        const slug = productName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        productUrl = `https://blinkit.com/prn/${slug}/prid/${productId}`;
    }

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

/**
 * Extract and normalize product-like objects from arbitrary payloads.
 * @param {Array<Object>} payloads - Payloads containing product data.
 * @returns {Array<Object>} Normalized product list.
 */
const extractProductsFromPayloads = (payloads = []) => {
    const rawProducts = [];
    const seenObjects = new Set();
    const nonProductPatterns = [
        'ads_vertical_banner',
        'ad_banner',
        'Vegetables & Fruits',
        'Dairy & Breakfast',
        'Munchies',
        'Cold Drinks',
        'Instant & Frozen',
        'Tea, Coffee',
        'Bakery & Biscuits',
        'Sweet Tooth',
        'Atta, Rice & Dal',
        'Dry Fruits, Masala',
        'Sauces & Spreads',
        'Chicken, Meat & Fish',
        'Paan Corner',
        'Organic & Premium',
        'Baby Care',
        'Pharma & Wellness',
        'Personal Care',
        'Home & Office',
        'Pet Care',
        'Cleaning Essentials',
        'Home Furnishing & Decor',
        'Beauty & Cosmetics',
        'Magazines',
        'Kitchen & Dining',
        'Fashion & Accessories',
    ];

    const isLikelyProduct = (obj) => {
        if (!obj || typeof obj !== 'object') return false;
        const base = obj.product && typeof obj.product === 'object' ? obj.product : obj;
        const name = extractName(base) || extractName(obj) || obj?.name?.text || obj?.name || null;
        if (!name || typeof name !== 'string' || name.trim().length === 0) return false;
        if (name === '[object Object]') return false;
        const lowerName = name.toLowerCase();
        if (nonProductPatterns.some(pattern => lowerName.includes(pattern.toLowerCase()))) return false;

        const price = extractPrice(base) ?? extractPrice(obj);
        const mrp = extractOriginalPrice(base) ?? extractOriginalPrice(obj);

        // Require pricing signals to avoid category tiles with ids but no prices.
        return price !== null || mrp !== null;
    };

    const pushProduct = (obj) => {
        if (!obj || typeof obj !== 'object') return;
        if (seenObjects.has(obj)) return;

        // Filter out non-product widgets (ads, banners, categories, etc.)
        if (obj.widget_type) {
            // Only allow product card widgets
            if (obj.widget_type !== 'product_card_snippet_type_2' &&
                obj.widget_type !== 'product_card' &&
                !obj.widget_type.includes('product')) {
                return; // Skip ads, banners, categories, etc.
            }
        }

        if (!isLikelyProduct(obj)) return;

        seenObjects.add(obj);
        rawProducts.push(obj);
    };

    const collectFromMap = (maybeMap) => {
        if (!maybeMap || typeof maybeMap !== 'object') return;
        if (Array.isArray(maybeMap)) {
            maybeMap.forEach(pushProduct);
            return;
        }
        Object.values(maybeMap).forEach(pushProduct);
    };

    const traverse = (node, depth = 0) => {
        if (!node || typeof node !== 'object' || depth > 8) return;

        if (Array.isArray(node)) {
            if (node.length > 0 && node.every(item => item && typeof item === 'object' && !Array.isArray(item))) {
                node.forEach(pushProduct);
            }
            node.forEach(child => traverse(child, depth + 1));
            return;
        }

        // Blinkit-specific structures
        if (node.entities && node.entities.products) collectFromMap(node.entities.products);
        if (node.products) collectFromMap(node.products);
        if (node.data && node.data.products) collectFromMap(node.data.products);
        if (node.product_grid && node.product_grid.products) collectFromMap(node.product_grid.products);
        if (node.widgets && Array.isArray(node.widgets)) node.widgets.forEach(pushProduct);
        if (node.widget && typeof node.widget === 'object') pushProduct(node.widget);
        if (node.items && Array.isArray(node.items)) node.items.forEach(pushProduct);

        for (const key of Object.keys(node)) {
            traverse(node[key], depth + 1);
        }
    };

    for (const payload of payloads) {
        if (!payload || typeof payload !== 'object') continue;
        traverse(payload, 0);
    }

    // Normalize and dedupe
    const seenKeys = new Set();
    const normalized = [];
    for (const raw of rawProducts) {
        const n = normalizeProduct(raw);
        if (!n.product_name) continue;
        if (n.price === null && n.original_price === null) continue;
        const key = `${n.product_name}|${n.price ?? ''}|${n.original_price ?? ''}|${n.product_image ?? ''}|${n.product_url ?? ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        normalized.push(n);
    }
    return normalized;
};

/**
 * Build normalized products from Blinkit Redux store data.
 * @param {Object|null} reduxStoreData - Redux store search data.
 * @returns {Array<Object>} Normalized product list.
 */
const buildProductsFromReduxData = (reduxStoreData) => {
    if (!reduxStoreData?.snippets) return [];
    const snippets = reduxStoreData.snippets.filter((snippet) => {
        if (snippet.widget_type !== 'product_card_snippet_type_2') return false;
        if (!snippet.data || !snippet.data.name) return false;
        const name = snippet.data.name?.text || snippet.data.name;
        if (!name || typeof name !== 'string' || name.trim().length === 0) return false;
        return true;
    });

    return snippets.map((snippet) => {
        const data = snippet.data || {};
        const tracking = snippet.tracking || {};
        const cartItem = data.atc_action?.add_to_cart?.cart_item || {};
        const impression = tracking.impression_map || {};

        const price = cartItem.price || impression.price || toNumber(data.price?.text) || null;
        const mrp = cartItem.mrp || impression.mrp || toNumber(data.mrp?.text) || null;
        const name = data.name?.text || data.name || cartItem.product_name || null;
        const id = cartItem.product_id || impression.product_id || data.product_id || null;

        let discount = data.discount?.text || null;
        if (!discount && price && mrp && mrp > price) {
            const off = Math.round(((mrp - price) / mrp) * 100);
            if (off > 0) discount = `${off}% OFF`;
        }

        let productUrl = null;
        if (id) {
            const slug = name ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'product';
            productUrl = `https://blinkit.com/prn/${slug}/prid/${id}`;
        }

        const isSoldOut = data.is_sold_out || false;
        const inventory = cartItem.inventory ?? impression.inventory ?? 0;
        const availability = (!isSoldOut && inventory > 0) ? 'In Stock' : 'Out of Stock';

        const deliveryTime = data.eta_tag?.text || data.delivery_time?.text || null;

        return {
            product_name: name,
            price,
            original_price: mrp,
            product_image: data.image?.url || cartItem.image_url || null,
            availability,
            product_url: productUrl,
            discount_percentage: discount,
            delivery_time: deliveryTime,
        };
    }).filter((p) => p.product_name && (p.price !== null || p.original_price !== null));
};

/**
 * Actor entry point.
 * @returns {Promise<void>} Resolves when the Actor exits.
 */
async function main() {
    try {
        const input = (await Actor.getInput()) || {};
        const {
            search_query = '',
            results_wanted: RESULTS_WANTED_RAW = 20,
            proxyConfiguration: proxyConfig,
            latitude,
            longitude,
            setGeolocation = true,
        } = input;

        const RESULTS_WANTED = Number.isFinite(+RESULTS_WANTED_RAW) && +RESULTS_WANTED_RAW > 0
            ? +RESULTS_WANTED_RAW
            : 0; // 0 means unlimited

        const searchQueryInput = typeof search_query === 'string' ? search_query.trim() : '';

        if (!searchQueryInput) {
            throw new Error('search_query is required and cannot be empty');
        }

        const searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(searchQueryInput)}`;
        const geoLatitude = Number.isFinite(+latitude) ? Number(latitude) : null;
        const geoLongitude = Number.isFinite(+longitude) ? Number(longitude) : null;

        log.info(`Starting Blinkit scraper for query: "${searchQueryInput}"`);
        log.info(`Target results: ${RESULTS_WANTED === 0 ? 'unlimited' : RESULTS_WANTED}`);
        log.info(`Search URL: ${searchUrl}`);

        // Create proxy configuration (residential recommended for Blinkit).
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
        const seenProductKeys = new Set();

        /**
         * Create a stable dedupe key for product records.
         * @param {Object} product - Normalized product object.
         * @returns {string|null} Dedupe key or null.
         */
        const makeProductKey = (product) => {
            if (!product) return null;
            const name = product.product_name || product.name || '';
            const price = product.price ?? '';
            const mrp = product.original_price ?? '';
            const image = product.product_image ?? '';
            const url = product.product_url ?? '';
            const key = `${name}|${price}|${mrp}|${image}|${url}`.trim();
            return key || null;
        };

        /**
         * Count visible product cards using known selectors.
         * @param {import('playwright').Page} page - Playwright page.
         * @returns {Promise<number>} Count of products.
         */
        const countProductsOnPage = async (page) => {
            for (const selector of SELECTORS.productContainer) {
                try {
                    const count = await page.locator(selector).count();
                    if (count > 0) return count;
                } catch {
                    // ignore selector errors
                }
            }
            return 0;
        };

        /**
         * Get product count from Blinkit Redux store if available.
         * @param {import('playwright').Page} page - Playwright page.
         * @returns {Promise<number>} Count from Redux store.
         */
        const getReduxProductCount = async (page) => {
            try {
                return await page.evaluate(() => {
                    const store = window.__reduxStore__?.getState?.();
                    const snippets = store?.ui?.search?.searchProductBffData?.snippets || [];
                    return snippets.filter(s => s?.widget_type === 'product_card_snippet_type_2' && s?.data?.name).length;
                });
            } catch {
                return 0;
            }
        };

        // Create Playwright crawler
        const crawler = new PlaywrightCrawler({
            proxyConfiguration,
            maxRequestRetries: 5,
            maxConcurrency: 1, // Reduced to 1 to minimize blocking risk
            requestHandlerTimeoutSecs: 300, // Increased for safety
            navigationTimeoutSecs: 120, // Increased to handle slow proxies
            useSessionPool: true,
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
                            loadTimes: () => { },
                            csi: () => { },
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
                    const pushResults = async (products, label) => {
                        if (!products || products.length === 0) return false;
                        const deduped = products.filter((p) => {
                            const key = makeProductKey(p);
                            if (!key) return false;
                            if (seenProductKeys.has(key)) return false;
                            seenProductKeys.add(key);
                            return true;
                        });
                        if (deduped.length === 0) return false;
                        const remaining = RESULTS_WANTED > 0 ? RESULTS_WANTED - totalScraped : products.length;
                        if (remaining <= 0) return true;
                        const limited = RESULTS_WANTED > 0 ? deduped.slice(0, remaining) : deduped;
                        const enriched = limited.map(p => ({
                            ...p,
                            search_query: searchQueryInput,
                            url: request.url,
                            scrapedAt: new Date().toISOString(),
                        }));
                        await Dataset.pushData(enriched);
                        totalScraped += enriched.length;
                        log.info(`Extracted ${enriched.length} products from ${label}`);
                        if (RESULTS_WANTED === 0) return true; // stop after a successful source when unlimited
                        return totalScraped >= RESULTS_WANTED;
                    };

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

                    // PRIORITY 0: Try to extract from Redux store (live Blinkit state)
                    log.info('Checking for Redux store...');
                    const reduxStoreData = await page.evaluate(() => {
                        try {
                            if (window.__reduxStore__) {
                                const state = window.__reduxStore__.getState();
                                // Extract the search snippets which contain product data
                                if (state.ui && state.ui.search && state.ui.search.searchProductBffData) {
                                    return state.ui.search.searchProductBffData;
                                }
                            }
                        } catch {
                            // ignore extraction errors in browser context
                        }
                        return null;
                    });

                    if (reduxStoreData && reduxStoreData.snippets) {
                        const products = buildProductsFromReduxData(reduxStoreData);
                        if (products.length > 0) {
                            const done = await pushResults(products, 'Redux Store');
                            if (done) return;
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
                        } catch {
                            // ignore extraction errors in browser context
                        }
                        return null;
                    });

                    if (nextDataProducts) {
                        const extracted = extractProductsFromPayloads([nextDataProducts]);
                        if (extracted.length > 0) {
                            const done = await pushResults(extracted, '__NEXT_DATA__');
                            if (done) return;
                        }
                    }

                    // PRIORITY 2: Scroll to load all products
                    log.info('Scrolling to load all products...');
                    let previousHeight = await page.evaluate(() => document.body.scrollHeight);
                    let previousCount = await countProductsOnPage(page);
                    let previousReduxCount = await getReduxProductCount(page);
                    let scrollAttempts = 0;
                    let stableRounds = 0;
                    const maxScrollAttempts = 40;
                    const maxStableRounds = 3;

                    while (scrollAttempts < maxScrollAttempts && stableRounds < maxStableRounds) {
                        if (RESULTS_WANTED > 0 && previousCount >= RESULTS_WANTED) {
                            log.info(`Reached target product count (${previousCount} >= ${RESULTS_WANTED})`);
                            break;
                        }

                        // Scroll to trigger lazy loading on the search results page.
                        await page.evaluate(() => {
                            window.scrollTo(0, document.body.scrollHeight);
                        });
                        await page.waitForTimeout(1200 + Math.random() * 1200);

                        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                        const currentCount = await countProductsOnPage(page);
                        const currentReduxCount = await getReduxProductCount(page);

                        // Stop when height and product counts stop growing across multiple rounds.
                        const grew = currentHeight > previousHeight || currentCount > previousCount || currentReduxCount > previousReduxCount;
                        if (!grew) {
                            stableRounds += 1;
                        } else {
                            stableRounds = 0;
                        }

                        previousHeight = currentHeight;
                        previousCount = currentCount;
                        previousReduxCount = currentReduxCount;
                        scrollAttempts++;
                    }

                    if (stableRounds >= maxStableRounds) {
                        log.info('Reached end of page or no new products loaded');
                    }
                    // TODO: Switch to API pagination if Blinkit exposes a stable search cursor.

                    log.info('Extracting product data from HTML...');

                    // PRIORITY 3: Re-check Redux store after scrolling
                    const reduxAfterScroll = await page.evaluate(() => {
                        try {
                            if (window.__reduxStore__) {
                                const state = window.__reduxStore__.getState();
                                if (state.ui && state.ui.search && state.ui.search.searchProductBffData) {
                                    return state.ui.search.searchProductBffData;
                                }
                            }
                        } catch {
                            // ignore extraction errors in browser context
                        }
                        return null;
                    });

                    if (reduxAfterScroll && reduxAfterScroll.snippets) {
                        const products = buildProductsFromReduxData(reduxAfterScroll);
                        if (products.length > 0) {
                            const done = await pushResults(products, 'Redux Store (after scroll)');
                            if (done) return;
                        }
                    }

                    // PRIORITY 4: Try captured JSON responses
                    const networkProducts = extractProductsFromPayloads(responsePayloads);
                    if (networkProducts.length > 0) {
                        const done = await pushResults(networkProducts, 'network JSON');
                        if (done) return;
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
                            if (productElements.length > 0) break;
                        }

                        if (productElements.length === 0) {
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
                    const enrichedProducts = products;
                    const done = await pushResults(enrichedProducts, 'DOM HTML');
                    if (done) return;

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
