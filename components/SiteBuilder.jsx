const { useState, useEffect } = React;

const SiteBuilder = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [blocks, setBlocks] = useState([]);
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [activeTheme, setActiveTheme] = useState('classic');
    const [message, setMessage] = useState('');
    const [username, setUsername] = useState('');
    const [brandColor, setBrandColor] = useState('#D4AF37');
    const [saving, setSaving] = useState(false);
    const [publishing, setPublishing] = useState(false);

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
                        if (blocks.length === 0) {
                            setBlocks([
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
                            ]);
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
            styles: getDefaultStyles(type)
        };
        
        setBlocks([...blocks, newBlock]);
        setSelectedBlock(newBlock.id);
        showMessage(`✨ ${type.charAt(0).toUpperCase() + type.slice(1)} block added!`);
        
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
        setBlocks(blocks.filter(block => block.id !== blockId));
        setSelectedBlock(null);
        showMessage('Block deleted');
    };

    const moveBlock = (blockId, direction) => {
        const currentIndex = blocks.findIndex(block => block.id === blockId);
        if (currentIndex === -1) return;

        const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
        if (newIndex < 0 || newIndex >= blocks.length) return;

        const newBlocks = [...blocks];
        [newBlocks[currentIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[currentIndex]];
        setBlocks(newBlocks);
    };

    const saveWebsite = async () => {
        if (!user) {
            showMessage('Please sign in to save your website');
            return;
        }

        setSaving(true);
        try {
            const config = {
                blocks,
                username,
                brandColor,
                theme: activeTheme,
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

        if (blocks.length === 0) {
            showMessage('Please add some content blocks before publishing');
            return;
        }

        setPublishing(true);
        try {
            // First save to cloud
            await saveWebsite();
            
            // Then publish
            const config = {
                username,
                blocks,
                theme: activeTheme,
                brandColor,
                userEmail: user.email,
                seoTitle: `${user.displayName || username} Photography`,
                seoDescription: 'Professional photography portfolio and services'
            };

            const result = await window.FirebaseManager.publishSite(config);
            
            if (result.success) {
                showMessage(`🚀 Website published successfully! View at: ${result.fullUrl}`, 8000);
                
                // Trigger celebration animation
                if (window.showCelebration) {
                    window.showCelebration('🌐 Website Published!', 50);
                }
                
                // Optionally open the published site
                setTimeout(() => {
                    if (confirm('Would you like to view your published website?')) {
                        window.open(result.fullUrl, '_blank');
                    }
                }, 2000);
            } else {
                throw new Error('Publish operation failed');
            }
        } catch (error) {
            console.error('Publish error:', error);
            showMessage(`❌ Error publishing website: ${error.message}`);
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
        
        // Render BlockLibrary
        React.createElement(window.BlockLibrary, {
            onAddBlock: addBlock,
            brandColor
        }),
        
        // Render LivePreview
        React.createElement(window.LivePreview, {
            blocks,
            selectedBlock,
            onSelectBlock: setSelectedBlock,
            onUpdateBlock: updateBlock,
            onDeleteBlock: deleteBlock,
            onMoveBlock: moveBlock,
            theme: activeTheme,
            brandColor
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