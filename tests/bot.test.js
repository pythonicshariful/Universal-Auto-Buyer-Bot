jest.mock('https-proxy-agent', () => ({
    HttpsProxyAgent: class HttpsProxyAgent {}
}));

const {
    ProxyManager,
    sendWebhook,
    setConfig,
    clearPreviousState,
    setPreviousState,
    handleProduct
} = require('../bot');

const nock = require('nock');

describe('Target Monitor Bot', () => {
    beforeEach(() => {
        // Reset state and config before each test
        clearPreviousState();
        setConfig({
            discordWebhookUrl: 'https://discord.com/api/webhooks/test/test',
            minDelay: 1000,
            maxDelay: 2000,
            dryRun: false
        });
        nock.cleanAll();
    });

    test('ProxyManager configuration parsing', () => {
        const pm = new ProxyManager();
        pm.updateProxies('127.0.0.1:8080:user:pass');
        const proxy = pm.getRandomProxy();
        expect(proxy.server).toBe('127.0.0.1:8080');
        expect(proxy.username).toBe('user');
        expect(proxy.password).toBe('pass');

        const agent = pm.getRandomProxyAgent();
        expect(agent).toBeDefined();
    });

    test('Deduplication of rapid webhooks', async () => {
        const productData = { url: 'http://test', name: 'Test', price: 10, in_stock: true };
        
        let requests = 0;
        nock('https://discord.com')
            .post('/api/webhooks/test/test')
            .reply(200, () => {
                requests++;
                return {};
            });

        // First send should pass
        await sendWebhook('Test', productData);
        // Second send immediately should be deduped
        await sendWebhook('Test', productData);

        expect(requests).toBe(1);
    });

    test('Dry-run enforcement', async () => {
        setConfig({
            discordWebhookUrl: 'https://discord.com/api/webhooks/test/test',
            dryRun: true
        });

        const productData = { url: 'http://test-dryrun', name: 'Test', price: 10, in_stock: true };
        
        // This would throw an error if the network request is made, because nock prevents unmocked requests by default or we can assert nothing was hit.
        let requests = 0;
        nock('https://discord.com')
            .post('/api/webhooks/test/test')
            .reply(200, () => {
                requests++;
                return {};
            });

        await sendWebhook('Test', productData);

        expect(requests).toBe(0);
    });

    test('Durable delivery / Retry', async () => {
        const productData = { url: 'http://test-retry', name: 'Test', price: 10, in_stock: true };
        
        let attempts = 0;
        nock('https://discord.com')
            .post('/api/webhooks/test/test')
            .replyWithError('Server Down')
            .post('/api/webhooks/test/test')
            .reply(200, () => {
                attempts++;
                return {};
            });

        // We temporarily override sleep in bot.js? Actually Jest can fake timers or we just wait the short 2000ms delay.
        // Wait, 2000ms is a bit long for a unit test. We'll let it run.
        await sendWebhook('Test Retry', productData);

        expect(attempts).toBe(1);
    }, 15000);
});
