/**
 * Configuration Loader for ZK2P DEX
 * 
 * Automatically detects environment (devnet/mainnet) and loads appropriate config.
 * Supports:
 * - URL parameter: ?network=mainnet
 * - localStorage: zk2p_network=mainnet
 * - Hostname detection: mainnet.* domains
 * - Fallback to config.json
 */

(function() {
    'use strict';
    
    function detectNetwork() {
        // 1. Check URL parameter
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('network') === 'mainnet') {
            return 'mainnet';
        }
        
        // 2. Check localStorage
        const storedNetwork = localStorage.getItem('zk2p_network');
        if (storedNetwork === 'mainnet' || storedNetwork === 'devnet') {
            return storedNetwork;
        }
        
        // 3. Check hostname
        if (window.location.hostname.includes('mainnet')) {
            return 'mainnet';
        }
        
        // 4. Default to devnet
        return 'devnet';
    }
    
    async function loadConfig() {
        const network = detectNetwork();
        const configFile = network === 'mainnet' ? 'config.mainnet.json' : 'config.devnet.json';
        
        try {
            const response = await fetch(configFile);
            if (!response.ok) {
                throw new Error(`Failed to load ${configFile}`);
            }
            const config = await response.json();
            config.network = network; // Ensure network is set
            return config;
        } catch (error) {
            console.warn(`[Config] Failed to load ${configFile}, trying fallback...`);
            
            // Fallback to default config.json
            try {
                const fallbackResponse = await fetch('config.json');
                if (!fallbackResponse.ok) {
                    throw new Error('Failed to load fallback config.json');
                }
                const fallbackConfig = await fallbackResponse.json();
                fallbackConfig.network = network;
                return fallbackConfig;
            } catch (fallbackError) {
                console.error('[Config] Failed to load any configuration file');
                throw fallbackError;
            }
        }
    }
    
    // Export to window for use in other scripts
    window.ZK2PConfig = {
        detectNetwork,
        loadConfig,
        setNetwork: function(network) {
            if (network === 'mainnet' || network === 'devnet') {
                localStorage.setItem('zk2p_network', network);
                console.log(`[Config] Network set to ${network}. Refresh page to apply.`);
            }
        },
        getNetwork: function() {
            return detectNetwork();
        }
    };
    
    console.log('[Config] Config loader initialized. Network:', detectNetwork());
})();

