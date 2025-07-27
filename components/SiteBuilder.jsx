const { useState, useEffect } = React;

const SiteBuilder = () => {
    // Multi-page website builder state
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activePage, setActivePage] = useState('home');
    const [siteBlocks, setSiteBlocks] = useState({
        home: [],
        about: [],
        gallery: [],
        contact: []
    });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeTheme, setActiveTheme] = useState('classic');
    const [currentThemeData, setCurrentThemeData] = useState(null);
    const [message, setMessage] = useState('');
    const [username, setUsername] = useState('');
    const [brandColor, setBrandColor] = useState('#D4AF37');
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Helper to get current page blocks
    const getCurrentPageBlocks = () => siteBlocks[activePage] || [];
    const setCurrentPageBlocks = (blocks) => {
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: blocks
        }));
    };

    // Initialize Firebase authentication
    useEffect(() => {
        const initializeAuth = () => {
            if (window.firebaseReady && window.onAuthStateChanged) {
                window.onAuthStateChanged(window.firebaseAuth, async (user) => {
                    setUser(user);
                    setLoading(false);
                    
                    if (user) {
                        // Set default username
                        setUsername(user.displayName?.toLowerCase().replace(/\s+/g, '') || 'photographer');
                        
                        // Load existing site config from Firestore
                        await loadSiteConfig(user.uid);
                        
                        // Add default blocks if none exist
                        if (siteBlocks.home.length === 0) {
                            setSiteBlocks(prev => ({
                                ...prev,
                                home: [
                                {
                                    id: `block-${Date.now()}`,
                                    type: 'heading',
                                    content: `Welcome to ${user.displayName || 'My'} Photography Studio`,
                                    styles: { 
                                        fontSize: '48px', 
                                        color: '#D4AF37', 
                                        textAlign: 'center', 
                                        fontWeight: 'bold',
                                        margin: '40px 0' 
                                    }
                                },
                                {
                                    id: `block-${Date.now() + 1}`,
                                    type: 'paragraph',
                                    content: 'Capturing life\'s most precious moments with artistic vision and professional excellence.',
                                    styles: { 
                                        fontSize: '18px', 
                                        color: '#333', 
                                        textAlign: 'center', 
                                        lineHeight: '1.6',
                                        margin: '20px 0',
                                        maxWidth: '600px',
                                        marginLeft: 'auto',
                                        marginRight: 'auto'
                                    }
                                },
                                {
                                    id: `block-${Date.now() + 2}`,
                                    type: 'button',
                                    content: 'View My Portfolio',
                                    styles: {
                                        backgroundColor: '#D4AF37',
                                        color: 'white',
                                        padding: '12px 30px',
                                        fontSize: '16px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        margin: '30px auto',
                                        display: 'block'
                                    }
                                }
                                ]
                            }));
                        }
                    } else {
                        // Demo data for non-authenticated users
                        setBlocks([
                            {
                                id: 1,
                                type: 'heading',
                                content: 'Welcome to My Studio',
                                styles: { fontSize: '36px', color: '#D4AF37', textAlign: 'center' }
                            },
                            {
                                id: 2,
                                type: 'paragraph',
                                content: 'This is a sample photography website.',
                                styles: { fontSize: '16px', textAlign: 'center' }
                            }
                        ]);
                    }
                });
            } else {
                setTimeout(initializeAuth, 100);
            }
        };
        
        initializeAuth();
    }, []);

    const loadSiteConfig = async (userId) => {
        try {
            const { doc, getDoc } = window.firebaseUtils;
            const docRef = doc(window.firebaseFirestore, 'users', userId, 'siteConfig', 'main');
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setBlocks(data.blocks || []);
                setUsername(data.username || username);
                setBrandColor(data.brandColor || '#D4AF37');
                setActiveTheme(data.theme || 'classic');
            }
        } catch (error) {
            console.error('Error loading site config:', error);
        }
    };

    const addBlock = (type) => {
        const newBlock = {
            id: `block-${Date.now()}`,
            type,
            content: getDefaultContent(type),
            styles: getDefaultStyles(type),
            animations: { type: 'fadeInUp', delay: '0.3s' }
        };
        
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: [...(prev[activePage] || []), newBlock]
        }));
        setSelectedBlock(newBlock.id);
        showMessage(`✨ ${type.charAt(0).toUpperCase() + type.slice(1)} added to ${activePage.charAt(0).toUpperCase() + activePage.slice(1)} page!`);
        
        // Trigger small celebration for block addition
        if (window.showCelebration) {
            setTimeout(() => {
                window.showCelebration('', 15); // Small confetti burst
            }, 100);
        }
    };

    const getDefaultContent = (type) => {
        switch (type) {
            case 'heading': return 'New Heading';
            case 'paragraph': return 'Add your content here...';
            case 'image': return 'https://via.placeholder.com/400x300?text=Your+Image';
            case 'button': return 'Click Me';
            default: return 'New Block';
        }
    };

    const getDefaultStyles = (type) => {
        const baseStyles = {
            margin: '20px 0'
        };

        switch (type) {
            case 'heading':
                return {
                    ...baseStyles,
                    fontSize: '32px',
                    color: brandColor,
                    textAlign: 'left',
                    fontWeight: 'bold'
                };
            case 'paragraph':
                return {
                    ...baseStyles,
                    fontSize: '16px',
                    color: '#333',
                    lineHeight: '1.6',
                    textAlign: 'left'
                };
            case 'image':
                return {
                    ...baseStyles,
                    width: '100%',
                    maxWidth: '400px',
                    height: 'auto',
                    borderRadius: '8px'
                };
            case 'button':
                return {
                    ...baseStyles,
                    backgroundColor: brandColor,
                    color: 'white',
                    padding: '10px 20px',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontSize: '16px'
                };
            default:
                return baseStyles;
        }
    };

    const updateBlock = (blockId, updates) => {
        setBlocks(blocks.map(block => 
            block.id === blockId ? { ...block, ...updates } : block
        ));
    };

    const deleteBlock = (blockId) => {
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: (prev[activePage] || []).filter(b => b.id !== blockId)
        }));
        setSelectedBlock(null);
        showMessage('Block deleted');
    };

    // Theme application function
    const applyTheme = (themeData) => {
        if (!themeData || !themeData.blocks) return;
        
        setSiteBlocks(themeData.blocks);
        setCurrentThemeData(themeData);
        setActiveTheme(themeData.meta.name.toLowerCase().replace(/\s+/g, '-'));
        setBrandColor(themeData.meta.primaryColor);
        
        showMessage(`🎨 ${themeData.meta.name} theme applied successfully!`);
        
        // Celebration animation for theme application
        if (window.showCelebration) {
            setTimeout(() => {
                window.showCelebration(`✨ ${themeData.meta.name} Theme Applied!`, 50);
            }, 200);
        }
    };

    const moveBlock = (blockId, direction) => {
        const currentPageBlocks = siteBlocks[activePage] || [];
        const currentIndex = currentPageBlocks.findIndex(block => block.id === blockId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentPageBlocks.length) return;

        const currentPageBlocks = siteBlocks[activePage] || [];
        const newBlocks = [...currentPageBlocks];
        [newBlocks[currentIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[currentIndex]];
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: newBlocks
        }));
    };

    const saveWebsite = async () => {
        if (!user) {
            showMessage('Please sign in to save your website');
            return;
        }

        setSaving(true);
        try {
            const config = {
                siteBlocks,
                username,
                brandColor,
                theme: activeTheme,
                themeData: currentThemeData,
                userEmail: user.email,
                seoTitle: `${user.displayName || username} Photography`,
                seoDescription: 'Professional photography portfolio and services'
            };

            const result = await window.FirebaseManager.saveSiteConfig(user.uid, config);
            
            if (result.success) {
                showMessage('✅ Website saved to cloud successfully!');
                console.log('Saved configuration:', result.data);
            } else {
                throw new Error('Save operation failed');
            }
        } catch (error) {
            console.error('Save error:', error);
            showMessage(`❌ Error saving website: ${error.message}`);
        } finally {
            setSaving(false);
        }
    };

    const publishWebsite = async () => {
        if (!user || !username) {
            showMessage('Please set a username and sign in first');
            return;
        }

        const totalBlocks = Object.values(siteBlocks).reduce((total, pageBlocks) => total + pageBlocks.length, 0);
        if (totalBlocks === 0) {
            showMessage('Please add some content blocks before publishing');
            return;
        }

        setPublishing(true);
        try {
            // First save to cloud
            await saveWebsite();
            
            // Enhanced publishing configuration
            const config = {
                username,
                siteBlocks,
                theme: activeTheme,
                themeData: currentThemeData,
                brandColor,
                userEmail: user.email,
                settings: {
                    seoTitle: `${user.displayName || username} Photography`,
                    seoDescription: 'Professional photography portfolio and services',
                    analytics: true, // Enable analytics tracking
                    customDomain: null
                }
            };

            // Use enhanced publisher if available, fallback to FirebaseManager
            let result;
            if (window.FirebasePublisher) {
                result = await window.FirebasePublisher.hybridPublish(config);
            } else {
                result = await window.FirebaseManager.publishSite(config);
            }
            
            if (result.success) {
                const publishUrl = window.FirebasePublisher ? 
                    window.FirebasePublisher.getPublishingUrl(result) : 
                    result.fullUrl;

                showMessage(`🚀 Website published via ${result.method}! View at: ${publishUrl}`, 10000);
                
                // Enhanced celebration animation
                if (window.showCelebration) {
                    window.showCelebration(`🌐 ${result.method === 'firebase-cloud-function' ? 'Firebase' : 'Local'} Publishing Complete!`, 60);
                }
                
                // Track publishing analytics
                if (window.FirebasePublisher) {
                    window.FirebasePublisher.trackPublishing(result, username);
                }
                
                // Optionally open the published site
                setTimeout(() => {
                    if (confirm(`Website published successfully! Would you like to view your ${result.method === 'firebase-cloud-function' ? 'Firebase-hosted' : 'locally-hosted'} website?`)) {
                        window.open(publishUrl, '_blank');
                    }
                }, 2500);
            } else {
                throw new Error('Publish operation failed');
            }
        } catch (error) {
            console.error('Publish error:', error);
            showMessage(`❌ Publishing failed: ${error.message}. Check console for details.`);
        } finally {
            setPublishing(false);
        }
    };

    const signInWithGoogle = async () => {
        try {
            const provider = new window.GoogleAuthProvider();
            await window.signInWithPopup(window.firebaseAuth, provider);
        } catch (error) {
            console.error('Sign-in error:', error);
            window.location.href = '/auth.html';
        }
    };

    const showMessage = (text, duration = 3000) => {
        setMessage(text);
        setTimeout(() => setMessage(''), duration);
    };

    if (loading) {
        return React.createElement(
            'div',
            { className: 'loading' },
            React.createElement('h2', null, 'Loading Advanced Website Builder...'),
            React.createElement('p', null, 'Initializing Firebase and React components')
        );
    }

    if (!user) {
        return React.createElement(
            'div',
            { className: 'auth-required' },
            React.createElement('h1', null, 'Advanced Website Builder'),
            React.createElement('p', null, 'Sign in to create stunning photography websites with our premium builder.'),
            React.createElement(
                'button',
                { onClick: signInWithGoogle, className: 'auth-btn' },
                '🔐 Sign In with Google'
            )
        );
    }

    return React.createElement(
        'div',
        { className: 'builder-container' },
        message && React.createElement('div', { className: 'message' }, message),
        
        // Page Navigator
        React.createElement(window.PageNavigator, {
            currentPage: activePage,
            setPage: setActivePage,
            siteBlocks: siteBlocks
        }),
        
        // Theme Selector
        React.createElement(window.ThemeSelector, {
            onApplyTheme: applyTheme,
            currentTheme: currentThemeData
        }),
        
        // Render BlockLibrary
        React.createElement(window.BlockLibrary, {
            onAddBlock: addBlock,
            brandColor
        }),
        
        // Render LivePreview with current page blocks
        React.createElement(window.LivePreview, {
            blocks: getCurrentPageBlocks(),
            selectedBlock,
            onSelectBlock: setSelectedBlock,
            onUpdateBlock: updateBlock,
            onDeleteBlock: deleteBlock,
            onMoveBlock: moveBlock,
            theme: activeTheme,
            brandColor,
            activePage: activePage
        }),

        // Properties Panel
        React.createElement(
            'div',
            { className: 'properties' },
            React.createElement('h3', null, '⚙️ Settings'),
            
            // Theme Selection
            React.createElement(
                'div',
                { className: 'property-group' },
                React.createElement('label', null, 'Theme'),
                React.createElement(
                    'select',
                    {
                        value: activeTheme,
                        onChange: (e) => setActiveTheme(e.target.value)
                    },
                    React.createElement('option', { value: 'classic' }, 'Classic Gold'),
                    React.createElement('option', { value: 'modern' }, 'Modern Blue'),
                    React.createElement('option', { value: 'dark' }, 'Dark Mode'),
                    React.createElement('option', { value: 'bold' }, 'Bold Headlines')
                )
            ),

            // Username
            React.createElement(
                'div',
                { className: 'property-group' },
                React.createElement('label', null, 'Username'),
                React.createElement('input', {
                    type: 'text',
                    value: username,
                    onChange: (e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '')),
                    placeholder: 'photographer'
                })
            ),

            // Brand Color
            React.createElement(
                'div',
                { className: 'property-group' },
                React.createElement('label', null, 'Brand Color'),
                React.createElement('input', {
                    type: 'color',
                    value: brandColor,
                    onChange: (e) => setBrandColor(e.target.value)
                })
            ),

            // Block Editor (if block selected)
            selectedBlock && React.createElement(window.BlockEditor, {
                block: blocks.find(b => b.id === selectedBlock),
                onUpdateBlock: updateBlock,
                brandColor
            }),

            // Action Buttons
            React.createElement(
                'button',
                {
                    className: 'btn-primary',
                    onClick: saveWebsite,
                    disabled: saving
                },
                saving ? '💾 Saving...' : '💾 Save Website'
            ),
            React.createElement(
                'button',
                {
                    className: 'btn-primary',
                    onClick: publishWebsite,
                    disabled: publishing || !username
                },
                publishing ? '🚀 Publishing...' : '🚀 Publish Website'
            )
        )
    );
};

window.SiteBuilder = SiteBuilder;