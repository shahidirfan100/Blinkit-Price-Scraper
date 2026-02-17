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
    skuId: ['sku_id', 'skuId', 'variant_id', 'variantId', 'item_id', 'itemId'],
    brand: ['brand', 'brand_name', 'brandName', 'brand_title', 'manufacturer', 'company'],
    quantity: ['quantity', 'qty', 'pack_size', 'packSize', 'net_quantity', 'netQuantity', 'weight', 'volume', 'size'],
    unit: ['unit', 'uom', 'unitOfMeasure', 'unit_of_measure', 'measurement_unit'],
    rating: ['rating', 'avg_rating', 'average_rating', 'product_rating', 'productRating'],
    ratingsCount: ['rating_count', 'ratings_count', 'reviews_count', 'review_count', 'ratingCount', 'ratingsCount'],
    inventory: ['inventory', 'inventory_count', 'available_quantity', 'availableQuantity', 'stock_count', 'stockCount'],
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

const compactObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    return Object.fromEntries(
        Object.entries(obj).filter(([, value]) => {
            if (value === null || value === undefined) return false;
            if (typeof value === 'number') return Number.isFinite(value);
            if (typeof value === 'string') return value.trim().length > 0;
            if (Array.isArray(value)) return value.length > 0;
            if (typeof value === 'object') return Object.keys(value).length > 0;
            return true;
        })
    );
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

const extractProductId = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.id);
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value).trim();
    return str ? str : null;
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
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    if (typeof value === 'object') {
        const nested = pickFirst(value, ['text', 'name', 'title', 'display_name', 'displayName']);
        if (nested === null || nested === undefined) return null;
        if (typeof nested === 'string') return nested.trim() || null;
        if (typeof nested === 'number' && Number.isFinite(nested)) return String(nested);
        return null;
    }
    return null;
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

const extractBrand = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.brand);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'object') {
        const nested = pickFirst(value, ['name', 'title', 'text', 'display_name', 'displayName']);
        if (typeof nested === 'string') return nested.trim() || null;
    }
    return String(value).trim() || null;
};

const extractQuantity = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.quantity);
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
        const str = value.trim();
        if (!str) return null;
        const num = toNumber(str);
        return num ?? str;
    }
    if (typeof value === 'object') {
        const nested = pickFirst(value, ['value', 'text', 'quantity', 'qty', 'amount']);
        return extractQuantity({ quantity: nested });
    }
    return null;
};

const extractUnit = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.unit);
    if (value === null || value === undefined) return null;
    if (typeof value === 'string') return value.trim() || null;
    if (typeof value === 'object') {
        const nested = pickFirst(value, ['text', 'name', 'title', 'unit']);
        if (typeof nested === 'string') return nested.trim() || null;
    }
    return String(value).trim() || null;
};

const extractRating = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.rating);
    const num = toNumber(value);
    return num === null ? null : num;
};

const extractRatingsCount = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.ratingsCount);
    const num = toNumber(value);
    return num === null ? null : Math.round(num);
};

const extractSkuId = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.skuId);
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const str = String(value).trim();
    return str ? str : null;
};

const extractInventory = (obj) => {
    const value = pickFirst(obj, PRODUCT_KEYS.inventory);
    const num = toNumber(value);
    return num === null ? null : Math.round(num);
};

const scoreProduct = (obj) => {
    let score = 0;
    if (extractName(obj)) score += 2;
    if (extractPrice(obj) !== null) score += 2;
    if (extractOriginalPrice(obj) !== null) score += 1;
    if (extractImage(obj)) score += 1;
    if (extractAvailability(obj)) score += 1;
    if (extractProductId(obj)) score += 1;
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
    const productUrlRaw = pickFirst(base, PRODUCT_KEYS.url) || pickFirst(raw, PRODUCT_KEYS.url) || null;
    const productId = extractProductId(base) ?? extractProductId(raw);
    const skuId = extractSkuId(base) ?? extractSkuId(raw);
    const brand = extractBrand(base) ?? extractBrand(raw);
    const quantity = extractQuantity(base) ?? extractQuantity(raw);
    const unit = extractUnit(base) ?? extractUnit(raw);
    const rating = extractRating(base) ?? extractRating(raw);
    const ratingsCount = extractRatingsCount(base) ?? extractRatingsCount(raw);
    const inventory = extractInventory(base) ?? extractInventory(raw);

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

    return compactObject({
        product_name: productName,
        price,
        original_price: originalPrice,
        discount_percentage: discount,
        product_image: image,
        availability: availability || 'Unknown',
        delivery_time: delivery,
        product_url: typeof productUrl === 'string' ? productUrl : null,
        product_id: productId,
        sku_id: skuId,
        brand,
        quantity,
        unit,
        rating,
        ratings_count: ratingsCount,
        inventory,
    });
};

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

        // IMPORTANT: Product *must* have a real price signal.
        // Categories/collections often have an id + title but no price, and should not be treated as products.
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
        // Only keep items with a real price signal.
        // This prevents category widgets from leaking into the dataset.
        if (n.price === null && n.original_price === null) continue;
        const key = `${n.product_name}|${n.price ?? ''}|${n.original_price ?? ''}|${n.product_image ?? ''}|${n.product_url ?? ''}`;
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);
        normalized.push(n);
    }
    return normalized;
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

        let searchQueryInput = typeof search_query === 'string' ? search_query.trim() : '';
        let searchUrl;
        let urlLatitude = null;
        let urlLongitude = null;

        if (searchUrlInput) {
            let u;
            try {
                u = new URL(searchUrlInput, 'https://blinkit.com');
            } catch {
                throw new Error('search_url must be a valid URL');
            }

            if (!/(^|\.)blinkit\.com$/i.test(u.hostname)) {
                throw new Error('search_url must be a blinkit.com URL');
            }

            const q = u.searchParams.get('q');
            if (q && q.trim()) searchQueryInput = q.trim();

            const latParam = u.searchParams.get('lat') ?? u.searchParams.get('latitude');
            const lngParam = u.searchParams.get('lng') ?? u.searchParams.get('longitude');
            if (latParam !== null) {
                const parsed = Number.parseFloat(String(latParam));
                if (Number.isFinite(parsed)) urlLatitude = parsed;
            }
            if (lngParam !== null) {
                const parsed = Number.parseFloat(String(lngParam));
                if (Number.isFinite(parsed)) urlLongitude = parsed;
            }

            searchUrl = u.toString();
        } else {
            if (!searchQueryInput) {
                throw new Error('Either search_query or search_url is required and cannot be empty');
            }
            searchUrl = `https://blinkit.com/s/?q=${encodeURIComponent(searchQueryInput)}`;
        }

        const geoLatitude = urlLatitude ?? (Number.isFinite(+latitude) ? Number(latitude) : null);
        const geoLongitude = urlLongitude ?? (Number.isFinite(+longitude) ? Number(longitude) : null);

        log.info(`Starting Blinkit scraper for query: "${searchQueryInput}"`);
        log.info(`Target results: ${RESULTS_WANTED === 0 ? 'unlimited' : RESULTS_WANTED}`);
        log.info(`Search URL: ${searchUrl}`);

        // Create proxy configuration (residential recommended for Blinkit)
        const proxyConfiguration = await Actor.createProxyConfiguration(proxyConfig || {
            useApifyProxy: true,
            apifyProxyGroups: ['RESIDENTIAL'],
        });

        let totalScraped = 0;
        const seenProductKeys = new Set();

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

        const getReduxProducts = async (page) => {
            try {
                const reduxStoreData = await page.evaluate(() => {
                    try {
                        const state = window.__reduxStore__?.getState?.();
                        if (state?.ui?.search?.searchProductBffData) return state.ui.search.searchProductBffData;
                    } catch (e) {
                        console.log('Redux store extraction failed:', e);
                    }
                    return null;
                });

                if (!reduxStoreData?.snippets) return [];

                const snippets = reduxStoreData.snippets.filter((s) => {
                    if (s?.widget_type !== 'product_card_snippet_type_2') return false;
                    if (!s?.data?.name) return false;
                    const name = s.data.name?.text || s.data.name;
                    return typeof name === 'string' && name.trim().length > 0;
                });

                return snippets
                    .map((snippet) => {
                        const data = snippet.data || {};
                        const tracking = snippet.tracking || {};
                        const cartItem = data.atc_action?.add_to_cart?.cart_item || {};
                        const impression = tracking.impression_map || {};

                        const price = cartItem.price || impression.price || toNumber(data.price?.text) || null;
                        const mrp = cartItem.mrp || impression.mrp || toNumber(data.mrp?.text) || null;
                        const nameValue = data.name?.text ?? data.name ?? cartItem.product_name ?? impression.product_name ?? impression.name ?? null;
                        const name = typeof nameValue === 'string' ? nameValue.trim() : null;
                        const id = cartItem.product_id || impression.product_id || data.product_id || null;

                        let discount = data.discount?.text || null;
                        if (!discount && price && mrp && mrp > price) {
                            const off = Math.round(((mrp - price) / mrp) * 100);
                            if (off > 0) discount = `${off}% OFF`;
                        }

                        let productUrl = null;
                        if (id) {
                            const slug = name ? String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'product';
                            productUrl = `https://blinkit.com/prn/${slug}/prid/${id}`;
                        }

                        const isSoldOut = data.is_sold_out || false;
                        const inventory = cartItem.inventory ?? impression.inventory ?? 0;
                        const availability = (!isSoldOut && inventory > 0) ? 'In Stock' : 'Out of Stock';
                        const deliveryTime = data.eta_tag?.text || data.delivery_time?.text || null;

                        const mergedRaw = {
                            ...data,
                            ...cartItem,
                            ...impression,
                            product_id: id,
                        };

                        const normalized = normalizeProduct(mergedRaw);
                        return compactObject({
                            ...normalized,
                            product_name: normalized.product_name || name,
                            price: normalized.price ?? price,
                            original_price: normalized.original_price ?? mrp,
                            product_image: normalized.product_image ?? (data.image?.url || cartItem.image_url || null),
                            availability,
                            product_url: normalized.product_url ?? productUrl,
                            discount_percentage: normalized.discount_percentage ?? discount,
                            delivery_time: normalized.delivery_time ?? deliveryTime,
                            inventory: normalized.inventory ?? (Number.isFinite(inventory) ? inventory : null),
                        });
                    })
                    .filter((p) => {
                        if (typeof p.product_name !== 'string' || !p.product_name.trim() || p.product_name === '[object Object]') return false;
                        return p.price !== null && p.price !== undefined;
                    });
            } catch {
                return [];
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
                            browsers: ['chrome'],
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
                        const remaining = RESULTS_WANTED > 0 ? RESULTS_WANTED - totalScraped : deduped.length;
                        if (remaining <= 0) return RESULTS_WANTED > 0;

                        const limited = RESULTS_WANTED > 0 ? deduped.slice(0, remaining) : deduped;
                        const enriched = limited
                            .map((p) => compactObject({
                                ...p,
                                search_query: searchQueryInput,
                                url: request.url,
                                scrapedAt: new Date().toISOString(),
                            }))
                            .filter((p) => p.product_name);

                        if (enriched.length === 0) return false;
                        await Dataset.pushData(enriched);
                        totalScraped += enriched.length;
                        log.info(`Extracted ${enriched.length} products from ${label}`);
                        return RESULTS_WANTED > 0 ? totalScraped >= RESULTS_WANTED : false;
                    };

                    const paginationCandidateParams = ['page', 'offset', 'from', 'start', 'cursor', 'skip'];
                    let bestPagedApi = null;

                    const scoreApiCandidate = (url, productsCount) => {
                        let score = productsCount;
                        try {
                            const u = new URL(url);
                            for (const key of paginationCandidateParams) {
                                if (u.searchParams.has(key)) score += 50;
                            }
                            if (/search|listing|plp|collection|browse|items|widgets/i.test(u.pathname)) score += 10;
                        } catch {
                            // ignore
                        }
                        return score;
                    };

                    const responseListener = async (response) => {
                        const url = response.url();
                        const contentType = response.headers()['content-type'] || '';
                        if (!contentType.includes('application/json') && !contentType.includes('text/json')) return;
                        if (!/search|catalog|product|listing|plp|collection|browse|autocomplete|autosuggest|items|v\\d+/i.test(url)) {
                            return;
                        }
                        if (responseUrls.has(url)) return;
                        try {
                            const json = await response.json();
                            responsePayloads.push(json);
                            responseUrls.add(url);

                            // Track a strong candidate for direct pagination (if it yields many products)
                            const products = extractProductsFromPayloads([json]);
                            if (products.length >= 10) {
                                const score = scoreApiCandidate(url, products.length);
                                if (!bestPagedApi || score > bestPagedApi.score) {
                                    bestPagedApi = { url, score, sampleCount: products.length };
                                }
                            }
                        } catch {
                            // Ignore non-JSON or unreadable responses
                        }
                    };

                    page.on('response', responseListener);

                    // Wait for page to load
                    await page.waitForLoadState('domcontentloaded');
                    await page.waitForLoadState('networkidle').catch(() => { });

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

                    // PRIORITY 0: Extract from Redux store (Blinkit client state)
                    log.info('Checking Redux store (JSON state)...');
                    const reduxProductsInitial = await getReduxProducts(page);
                    if (reduxProductsInitial.length > 0) {
                        const done = await pushResults(reduxProductsInitial, 'Redux Store');
                        if (done) return;
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
                            const done = await pushResults(extracted, '__NEXT_DATA__');
                            if (done) return;
                        }
                    }

                    // PRIORITY 2: Scroll to trigger more JSON pagination requests (no DOM parsing)
                    log.info('Scrolling to trigger more JSON pagination...');
                    let previousHeight = await page.evaluate(() => document.body.scrollHeight);
                    let previousReduxCount = reduxProductsInitial.length;
                    let previousResponseCount = responseUrls.size;
                    let scrollAttempts = 0;
                    let stableRounds = 0;
                    const maxScrollAttempts = 40;
                    const maxStableRounds = 3;

                    while (scrollAttempts < maxScrollAttempts && stableRounds < maxStableRounds) {
                        if (RESULTS_WANTED > 0 && totalScraped >= RESULTS_WANTED) break;

                        await page.evaluate(() => {
                            window.scrollTo(0, document.body.scrollHeight);
                        });
                        await page.waitForTimeout(1200 + Math.random() * 1200);

                        const reduxProducts = await getReduxProducts(page);
                        if (reduxProducts.length > 0) {
                            const done = await pushResults(reduxProducts, 'Redux Store (scroll)');
                            if (done) return;
                        }

                        const networkProducts = extractProductsFromPayloads(responsePayloads);
                        if (networkProducts.length > 0) {
                            const done = await pushResults(networkProducts, 'network JSON');
                            if (done) return;
                        }

                        const currentHeight = await page.evaluate(() => document.body.scrollHeight);
                        const currentReduxCount = reduxProducts.length;
                        const currentResponseCount = responseUrls.size;

                        const grew =
                            currentHeight > previousHeight ||
                            currentReduxCount > previousReduxCount ||
                            currentResponseCount > previousResponseCount;

                        if (!grew) stableRounds += 1;
                        else stableRounds = 0;

                        previousHeight = currentHeight;
                        previousReduxCount = currentReduxCount;
                        previousResponseCount = currentResponseCount;
                        scrollAttempts++;
                    }

                    if (stableRounds >= maxStableRounds) {
                        log.info('Reached end of page or no new products loaded');
                    }

                    // Final attempt: prefer JSON sources only
                    const reduxFinal = await getReduxProducts(page);
                    if (reduxFinal.length > 0) {
                        const done = await pushResults(reduxFinal, 'Redux Store (final)');
                        if (done) return;
                    }

                    const networkFinal = extractProductsFromPayloads(responsePayloads);
                    if (networkFinal.length > 0) {
                        const done = await pushResults(networkFinal, 'network JSON (final)');
                        if (done) return;
                    }

                    // PRIORITY 3: If we saw a paginatable internal JSON endpoint, try fetching it directly
                    // using the current browser session (avoids relying purely on lazy-load scrolling).
                    if (RESULTS_WANTED > 0 && totalScraped < RESULTS_WANTED && bestPagedApi?.url) {
                        log.info(`Attempting direct pagination via internal JSON endpoint (sample ${bestPagedApi.sampleCount} items): ${bestPagedApi.url}`);

                        const fetchNext = async (baseUrl, iteration) => {
                            const u = new URL(baseUrl);

                            const detectStep = () => {
                                const limitLike = u.searchParams.get('limit') ?? u.searchParams.get('size') ?? u.searchParams.get('count');
                                const parsed = Number.parseInt(String(limitLike || ''), 10);
                                return Number.isFinite(parsed) && parsed > 0 ? parsed : 24;
                            };

                            // Heuristics: try incrementing a known pagination param if present.
                            const bumpParam = (key, delta) => {
                                const current = Number.parseInt(u.searchParams.get(key) || '0', 10);
                                const next = Number.isFinite(current) ? current + delta : delta;
                                u.searchParams.set(key, String(next));
                                return true;
                            };

                            if (u.searchParams.has('page')) bumpParam('page', 1);
                            else if (u.searchParams.has('offset')) bumpParam('offset', detectStep());
                            else if (u.searchParams.has('from')) bumpParam('from', detectStep());
                            else if (u.searchParams.has('start')) bumpParam('start', detectStep());
                            else if (u.searchParams.has('skip')) bumpParam('skip', detectStep());
                            else {
                                // If there is no obvious pagination param, we can't safely iterate.
                                return null;
                            }
                            return u.toString();
                        };

                        let lastAdded = totalScraped;
                        for (let i = 0; i < 15 && totalScraped < RESULTS_WANTED; i++) {
                            const nextUrl = await fetchNext(bestPagedApi.url, i + 1);
                            if (!nextUrl) break;

                            try {
                                const apiRes = await page.request.fetch(nextUrl, {
                                    headers: {
                                        accept: 'application/json, text/plain, */*',
                                        'app_client': 'web',
                                    },
                                    timeout: 60_000,
                                });

                                if (!apiRes.ok()) {
                                    log.warning(`Direct pagination request failed: ${apiRes.status()} ${nextUrl}`);
                                    break;
                                }

                                const json = await apiRes.json();
                                const products = extractProductsFromPayloads([json]);
                                if (products.length === 0) {
                                    log.info('Direct pagination returned 0 products; stopping.');
                                    break;
                                }

                                const done = await pushResults(products, `direct paged JSON (#${i + 1})`);
                                if (done) return;

                                if (totalScraped === lastAdded) {
                                    log.info('Direct pagination did not add new products; stopping.');
                                    break;
                                }
                                lastAdded = totalScraped;
                            } catch (e) {
                                log.warning('Direct pagination attempt failed; stopping.');
                                break;
                            }
                        }
                    }

                    log.warning('No products extracted from JSON sources. Saving debug artifacts...');
                    log.warning('If results are empty, Blinkit may require a delivery location. Consider enabling setGeolocation with latitude/longitude.');
                    await Actor.setValue('debug-no-products', await page.content(), { contentType: 'text/html' });
                    await Actor.setValue('debug-response-urls', JSON.stringify(Array.from(responseUrls), null, 2), { contentType: 'application/json' });
                    return;

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
