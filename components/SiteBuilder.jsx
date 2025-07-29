const { useState, useEffect } = React;

const SiteBuilder = () => {
    // Multi-page website builder state
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [templatesLoaded, setTemplatesLoaded] = useState(false);
    const [activePage, setActivePage] = useState('home');
    const [sitePages, setSitePages] = useState([
        { id: 'home', name: 'Home', url: '/', active: true },
        { id: 'about', name: 'About', url: '/about', active: true },
        { id: 'portfolio', name: 'Portfolio', url: '/portfolio', active: true },
        { id: 'blog', name: 'Blog', url: '/blog', active: true },
        { id: 'contact', name: 'Contact', url: '/contact', active: true },
        { id: 'privacy', name: 'Privacy Policy', url: '/privacy', active: true }
    ]);
    const [siteBlocks, setSiteBlocks] = useState({
        home: [],
        about: [],
        portfolio: [],
        blog: [],
        contact: [],
        privacy: []
    });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeTheme, setActiveTheme] = useState('classic');
    const [currentThemeData, setCurrentThemeData] = useState(null);
    const [message, setMessage] = useState('');
    const [username, setUsername] = useState('');
    const [brandColor, setBrandColor] = useState('#D4AF37');
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

    // Initialize component
    useEffect(() => {
        const initializeBuilder = async () => {
            console.log('SiteBuilder: Initializing component...');
            
            try {
                // Check if Firebase auth is available
                if (window.firebase && window.firebase.auth) {
                    const unsubscribe = window.firebase.auth().onAuthStateChanged((firebaseUser) => {
                        if (firebaseUser) {
                            setUser(firebaseUser);
                            console.log('SiteBuilder: User authenticated:', firebaseUser.email);
                        } else {
                            setUser(null);
                            console.log('SiteBuilder: No user authenticated');
                        }
                        setLoading(false);
                    });
                    
                    return () => unsubscribe();
                } else {
                    // No Firebase auth available, set to not loading
                    console.log('SiteBuilder: No Firebase auth available, proceeding without auth');
                    setLoading(false);
                }
                
                // Check templates loading
                if (window.PresetTemplates && Object.keys(window.PresetTemplates).length > 0) {
                    setTemplatesLoaded(true);
                    console.log('SiteBuilder: Templates loaded successfully:', Object.keys(window.PresetTemplates).length);
                }
            } catch (error) {
                console.error('SiteBuilder: Initialization error:', error);
                setLoading(false);
            }
        };

        initializeBuilder();
    }, []);

    // Message management
    const showMessage = (msg, type = 'info', duration = 5000) => {
        setMessage(msg);
        setTimeout(() => setMessage(''), duration);
    };

    // Helper to get current page blocks
    const getCurrentPageBlocks = () => siteBlocks[activePage] || [];
    const setCurrentPageBlocks = (blocks) => {
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: blocks
        }));
    };

    // Page management functions
    const addNewPage = () => {
        const pageName = prompt('Enter page name:');
        if (pageName && pageName.trim()) {
            const pageId = pageName.toLowerCase().replace(/[^a-z0-9]/g, '');
            const pageUrl = `/${pageId}`;
            
            setSitePages(prev => [...prev, {
                id: pageId,
                name: pageName.trim(),
                url: pageUrl,
                active: true
            }]);
            
            setSiteBlocks(prev => ({
                ...prev,
                [pageId]: [{
                    id: `block-${Date.now()}`,
                    type: 'heading',
                    content: pageName.trim(),
                    styles: { 
                        fontSize: '36px', 
                        color: '#D4AF37', 
                        textAlign: 'center', 
                        fontWeight: 'bold',
                        margin: '40px 0' 
                    }
                }]
            }));
            
            setActivePage(pageId);
            showMessage(`✅ Page "${pageName}" created successfully!`, 'success');
        }
    };

    const editPageName = (pageId) => {
        const page = sitePages.find(p => p.id === pageId);
        if (page) {
            const newName = prompt('Enter new page name:', page.name);
            if (newName && newName.trim()) {
                setSitePages(prev => prev.map(p => 
                    p.id === pageId ? { ...p, name: newName.trim() } : p
                ));
                showMessage(`✅ Page renamed to "${newName}"`, 'success');
            }
        }
    };

    const togglePageVisibility = (pageId) => {
        setSitePages(prev => prev.map(p => 
            p.id === pageId ? { ...p, active: !p.active } : p
        ));
        showMessage('✅ Page visibility updated', 'success');
    };

    const deletePage = (pageId) => {
        if (pageId === 'home') {
            showMessage('❌ Cannot delete the home page', 'error');
            return;
        }
        
        if (confirm('Are you sure you want to delete this page?')) {
            setSitePages(prev => prev.filter(p => p.id !== pageId));
            setSiteBlocks(prev => {
                const newBlocks = { ...prev };
                delete newBlocks[pageId];
                return newBlocks;
            });
            
            if (activePage === pageId) {
                setActivePage('home');
            }
            
            showMessage('✅ Page deleted successfully', 'success');
        }
    };

    // Template application function
    const applyTemplate = (templateKey) => {
        if (window.PresetTemplates && window.PresetTemplates[templateKey]) {
            const template = window.PresetTemplates[templateKey];
            
            // Validate template has pages
            if (!template.pages || Object.keys(template.pages).length === 0) {
                showMessage(`❌ Template ${template.name} has no pages to load`, 'error');
                return;
            }
            
            // Apply template pages
            const templatePageIds = Object.keys(template.pages);
            const newPages = templatePageIds.map(pageId => ({
                id: pageId,
                name: pageId.charAt(0).toUpperCase() + pageId.slice(1),
                url: pageId === 'home' ? '/' : `/${pageId}`,
                active: true
            }));
            
            // Validate each page has content
            const validatedPages = {};
            templatePageIds.forEach(pageId => {
                const pageContent = template.pages[pageId];
                if (pageContent && Array.isArray(pageContent) && pageContent.length > 0) {
                    validatedPages[pageId] = pageContent;
                } else {
                    console.warn(`Page ${pageId} in template ${templateKey} has no content blocks`);
                    // Add default content for empty pages
                    validatedPages[pageId] = [{
                        id: `default-${Date.now()}`,
                        type: 'heading',
                        content: `${pageId.charAt(0).toUpperCase() + pageId.slice(1)} Page`,
                        styles: {
                            fontSize: '36px',
                            color: '#D4AF37',
                            textAlign: 'center',
                            fontWeight: 'bold',
                            margin: '40px 0'
                        }
                    }];
                }
            });
            
            setSitePages(newPages);
            setSiteBlocks(validatedPages);
            setActivePage('home');
            
            showMessage(`✅ ${template.name} template applied with ${templatePageIds.length} pages!`, 'success');
            
            // Log applied pages for debugging
            console.log('Applied template pages:', templatePageIds);
            console.log('Page content validation:', validatedPages);
            
            // Trigger celebration animation
            if (window.showCelebration) {
                window.showCelebration(`🎨 ${template.name} Template Applied!`, 50);
            }
        } else {
            showMessage(`❌ Template ${templateKey} not found`, 'error');
        }
    };



    // Check if templates are loaded
    useEffect(() => {
        const checkTemplates = () => {
            if (window.PresetTemplates && Object.keys(window.PresetTemplates).length > 0) {
                console.log('SiteBuilder: Templates loaded successfully:', Object.keys(window.PresetTemplates).length);
                setTemplatesLoaded(true);
            } else {
                console.log('SiteBuilder: Waiting for templates to load...');
                setTimeout(checkTemplates, 100);
            }
        };
        checkTemplates();
    }, []);

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
                        
                        // Add default blocks if none exist for home page
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
        setSiteBlocks(prev => ({
            ...prev,
            [activePage]: (prev[activePage] || []).map(block => 
                block.id === blockId ? { ...block, ...updates } : block
            )
        }));
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

    // Preset website application function
    const applyPreset = (presetData) => {
        if (!presetData || !presetData.pages) return;
        
        setSiteBlocks(presetData.pages);
        setCurrentThemeData(presetData);
        setActiveTheme(presetData.meta.name.toLowerCase().replace(/\s+/g, '-'));
        setBrandColor(presetData.meta.brandColor);
        
        showMessage(`🚀 ${presetData.meta.name} website template applied successfully!`);
        
        // Celebration animation for preset application
        if (window.showCelebration) {
            setTimeout(() => {
                window.showCelebration(`🎯 ${presetData.meta.name} Template Applied!`, 60);
            }, 200);
        }
    };

    const moveBlock = (blockId, direction) => {
        const currentPageBlocks = siteBlocks[activePage] || [];
        const currentIndex = currentPageBlocks.findIndex(block => block.id === blockId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= currentPageBlocks.length) return;

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
        
        // Page Manager
        React.createElement(window.PageManager, {
            sitePages: sitePages,
            activePage: activePage,
            setActivePage: setActivePage,
            addNewPage: addNewPage,
            editPageName: editPageName,
            togglePageVisibility: togglePageVisibility,
            deletePage: deletePage
        }),
        
        // Template Selector
        React.createElement(window.TemplateSelector, {
            onApplyTemplate: applyTemplate,
            currentTheme: activeTheme
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
                block: getCurrentPageBlocks().find(b => b.id === selectedBlock),
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