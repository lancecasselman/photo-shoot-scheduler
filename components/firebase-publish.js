// Enhanced Firebase Publishing Integration for Replit
// Provides modern Firebase v9+ API integration with fallback support

class FirebasePublisher {
    constructor() {
        this.functions = null;
        this.initialized = false;
        this.initializeModern();
    }

    async initializeModern() {
        try {
            // Check if modern Firebase is available
            if (window.firebase && window.firebase.functions) {
                this.functions = window.firebase.functions();
                this.initialized = true;
                console.log('Firebase Publisher initialized with v8 compat API');
            } else {
                console.log('Firebase Publisher: No functions available, using fallback');
            }
        } catch (error) {
            console.warn('Firebase Publisher initialization failed:', error);
        }
    }

    async publishSiteToFirebase(config) {
        if (!this.initialized || !this.functions) {
            throw new Error('Firebase Functions not available');
        }

        try {
            const publishFunction = this.functions.httpsCallable('generateStaticSite');
            const result = await publishFunction(config);

            if (result.data.success) {
                return {
                    success: true,
                    url: result.data.url,
                    storageUrl: result.data.storageUrl,
                    publishedAt: result.data.publishedAt,
                    method: 'firebase-cloud-function'
                };
            } else {
                throw new Error('Firebase function returned failure');
            }
        } catch (error) {
            console.error('Firebase publishing failed:', error);
            throw error;
        }
    }

    async publishSiteToReplit(config) {
        try {
            const response = await fetch('/api/publish-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify(config)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            return {
                success: true,
                url: result.url,
                fullUrl: `${window.location.origin}${result.url}`,
                publishedAt: new Date().toISOString(),
                method: 'replit-local-api'
            };
        } catch (error) {
            console.error('Replit publishing failed:', error);
            throw error;
        }
    }

    async hybridPublish(config) {
        const { username, blocks, theme, brandColor, userEmail, settings } = config;

        if (!username || !blocks) {
            throw new Error('Username and blocks are required for publishing');
        }

        const publishConfig = {
            username,
            blocks,
            theme: theme || 'classic',
            brandColor: brandColor || '#D4AF37',
            userEmail,
            settings: {
                seoTitle: settings?.seoTitle || `${username} Photography`,
                seoDescription: settings?.seoDescription || 'Professional photography portfolio',
                analytics: settings?.analytics || false,
                customDomain: settings?.customDomain || null
            },
            metadata: {
                publishedAt: new Date().toISOString(),
                version: '2.0',
                builderType: 'advanced-hybrid'
            }
        };

        // Try Firebase first, fallback to Replit
        try {
            console.log('Attempting Firebase Cloud Function publishing...');
            return await this.publishSiteToFirebase(publishConfig);
        } catch (firebaseError) {
            console.warn('Firebase publishing failed, using Replit fallback:', firebaseError.message);
            return await this.publishSiteToReplit(publishConfig);
        }
    }

    // Utility method to get the best publishing URL
    getPublishingUrl(result) {
        if (result.method === 'firebase-cloud-function') {
            return result.storageUrl || result.url;
        } else {
            return result.fullUrl || result.url;
        }
    }

    // Utility method to track publishing analytics
    trackPublishing(result, username) {
        try {
            console.log(`Site published for ${username}:`, {
                method: result.method,
                url: this.getPublishingUrl(result),
                publishedAt: result.publishedAt,
                success: result.success
            });

            // Optional: Send analytics event
            if (window.gtag) {
                window.gtag('event', 'site_published', {
                    method: result.method,
                    username: username,
                    timestamp: result.publishedAt
                });
            }
        } catch (error) {
            console.warn('Analytics tracking failed:', error);
        }
    }
}

// Create global instance
if (typeof window !== 'undefined') {
    window.FirebasePublisher = new FirebasePublisher();
    
    // Expose publishing function for easy access
    window.publishSite = async (config) => {
        return await window.FirebasePublisher.hybridPublish(config);
    };
}