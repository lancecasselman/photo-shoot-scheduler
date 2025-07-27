// Premium Website Builder - Main Component
import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import BlockLibrary from './BlockLibrary.js';
import LivePreview from './LivePreview.jsx';
import './SiteBuilder.css';

// Firebase configuration (matches your existing config)
const firebaseConfig = {
    apiKey: "AIzaSyDbtboh1bW6xu9Tz9FILkx_0lzGwXQHjyM",
    authDomain: "photoshcheduleapp.firebaseapp.com",
    projectId: "photoshcheduleapp",
    storageBucket: "photoshcheduleapp.appspot.com",
    messagingSenderId: "1080892259604",
    appId: "1:1080892259604:web:9c8f4e5d6a7b8c9d0e1f2g"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const SiteBuilder = () => {
    const [user, setUser] = useState(null);
    const [siteConfig, setSiteConfig] = useState({
        blocks: [],
        brandColor: '#D4AF37',
        fontFamily: 'Inter, sans-serif',
        username: '',
        customDomain: ''
    });
    const [selectedBlock, setSelectedBlock] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [activeTheme, setActiveTheme] = useState('classic');

    // Authentication listener
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                await loadSiteConfig(user.uid);
                
                // Auto-generate default content for new users
                if (siteConfig.blocks.length === 0) {
                    const defaultBlocks = [
                        {
                            id: `block-${Date.now()}-1`,
                            type: 'heading',
                            content: `Hi, I'm ${user.displayName || 'Your Name'}`,
                            styles: { 
                                fontSize: '48px', 
                                color: '#D4AF37', 
                                textAlign: 'center',
                                fontWeight: 'bold',
                                marginBottom: '20px'
                            }
                        },
                        {
                            id: `block-${Date.now()}-2`,
                            type: 'paragraph',
                            content: 'Welcome to my photography studio. I specialize in capturing life\'s most precious moments with creativity and passion.',
                            styles: { 
                                fontSize: '18px', 
                                color: '#333', 
                                textAlign: 'center',
                                lineHeight: '1.6',
                                maxWidth: '600px',
                                margin: '0 auto'
                            }
                        },
                        {
                            id: `block-${Date.now()}-3`,
                            type: 'button',
                            content: 'View My Portfolio',
                            styles: { 
                                backgroundColor: '#D4AF37',
                                color: 'white',
                                padding: '15px 30px',
                                fontSize: '16px',
                                border: 'none',
                                borderRadius: '5px',
                                cursor: 'pointer',
                                margin: '20px auto',
                                display: 'block'
                            }
                        }
                    ];
                    
                    setSiteConfig(prev => ({
                        ...prev,
                        blocks: defaultBlocks,
                        username: user.displayName?.toLowerCase().replace(/\s+/g, '') || 'photographer'
                    }));
                }
            } else {
                setUser(null);
            }
        });

        return () => unsubscribe();
    }, []);

    // Load site configuration from Firestore
    const loadSiteConfig = async (userId) => {
        try {
            const docRef = doc(db, 'websites', userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                setSiteConfig(data.siteConfig || siteConfig);
                setMessage('Website loaded successfully');
            }
        } catch (error) {
            console.error('Error loading site config:', error);
            setMessage('Error loading website data');
        }
    };

    // Save site configuration to Firestore
    const saveSiteConfig = async () => {
        if (!user) {
            setMessage('Please sign in to save your website');
            return;
        }

        setIsLoading(true);
        try {
            const docRef = doc(db, 'websites', user.uid);
            await setDoc(docRef, {
                siteConfig,
                userId: user.uid,
                userEmail: user.email,
                lastModified: new Date().toISOString()
            }, { merge: true });
            
            setMessage('Website saved successfully!');
            
            // Also save to localStorage as backup
            localStorage.setItem(`siteBuilder_${user.uid}`, JSON.stringify(siteConfig));
        } catch (error) {
            console.error('Error saving site config:', error);
            setMessage('Error saving website');
        }
        setIsLoading(false);
    };

    // Publish static site
    const publishStaticSite = async () => {
        if (!user) {
            setMessage('Please sign in to publish your website');
            return;
        }

        if (!siteConfig.username) {
            setMessage('Please set a username for your published site');
            return;
        }

        setIsLoading(true);
        try {
            // Send site config to server for static generation
            const response = await fetch('/api/publish-static-site', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await user.getIdToken()}`
                },
                body: JSON.stringify({
                    siteConfig,
                    theme: activeTheme,
                    username: siteConfig.username
                })
            });

            if (response.ok) {
                const result = await response.json();
                setMessage(`Site published! View at: ${result.publishedUrl}`);
                
                // Copy URL to clipboard
                if (navigator.clipboard) {
                    await navigator.clipboard.writeText(result.publishedUrl);
                    setMessage(prev => prev + ' (URL copied to clipboard)');
                }
            } else {
                throw new Error('Failed to publish site');
            }
        } catch (error) {
            console.error('Error publishing site:', error);
            setMessage('Error publishing website');
        }
        setIsLoading(false);
    };

    // Add new block
    const addBlock = (blockType) => {
        const newBlock = {
            id: `block-${Date.now()}`,
            type: blockType,
            content: getDefaultContent(blockType),
            styles: getDefaultStyles(blockType)
        };

        setSiteConfig(prev => ({
            ...prev,
            blocks: [...prev.blocks, newBlock]
        }));
        
        setSelectedBlock(newBlock.id);
    };

    // Get default content for block types
    const getDefaultContent = (type) => {
        switch (type) {
            case 'heading': return 'Your Heading Here';
            case 'paragraph': return 'Your paragraph text goes here. Edit this to add your own content.';
            case 'image': return '/placeholder-image.jpg';
            case 'button': return 'Click Me';
            default: return '';
        }
    };

    // Get default styles for block types
    const getDefaultStyles = (type) => {
        const baseStyles = {
            heading: { 
                fontSize: '32px', 
                color: siteConfig.brandColor, 
                textAlign: 'center',
                fontWeight: 'bold',
                marginBottom: '20px'
            },
            paragraph: { 
                fontSize: '16px', 
                color: '#333', 
                textAlign: 'left',
                lineHeight: '1.6',
                marginBottom: '15px'
            },
            image: { 
                width: '100%', 
                maxWidth: '500px',
                height: 'auto',
                display: 'block',
                margin: '20px auto'
            },
            button: { 
                backgroundColor: siteConfig.brandColor,
                color: 'white',
                padding: '12px 24px',
                fontSize: '16px',
                border: 'none',
                borderRadius: '5px',
                cursor: 'pointer',
                margin: '10px auto',
                display: 'block'
            }
        };
        return baseStyles[type] || {};
    };

    // Update block content or styles
    const updateBlock = (blockId, updates) => {
        setSiteConfig(prev => ({
            ...prev,
            blocks: prev.blocks.map(block => 
                block.id === blockId 
                    ? { ...block, ...updates }
                    : block
            )
        }));
    };

    // Delete block
    const deleteBlock = (blockId) => {
        setSiteConfig(prev => ({
            ...prev,
            blocks: prev.blocks.filter(block => block.id !== blockId)
        }));
        
        if (selectedBlock === blockId) {
            setSelectedBlock(null);
        }
    };

    // Move block up/down
    const moveBlock = (blockId, direction) => {
        const blockIndex = siteConfig.blocks.findIndex(b => b.id === blockId);
        if (blockIndex === -1) return;

        const newIndex = direction === 'up' 
            ? Math.max(0, blockIndex - 1)
            : Math.min(siteConfig.blocks.length - 1, blockIndex + 1);
        
        if (newIndex === blockIndex) return;

        const newBlocks = [...siteConfig.blocks];
        [newBlocks[blockIndex], newBlocks[newIndex]] = [newBlocks[newIndex], newBlocks[blockIndex]];
        
        setSiteConfig(prev => ({ ...prev, blocks: newBlocks }));
    };

    // Apply theme
    const applyTheme = (theme) => {
        setActiveTheme(theme);
        const themes = {
            classic: { brandColor: '#D4AF37', fontFamily: 'Georgia, serif' },
            modern: { brandColor: '#2563EB', fontFamily: 'Inter, sans-serif' },
            dark: { brandColor: '#10B981', fontFamily: 'Roboto, sans-serif' },
            bold: { brandColor: '#DC2626', fontFamily: 'Montserrat, sans-serif' }
        };
        
        setSiteConfig(prev => ({ ...prev, ...themes[theme] }));
    };

    if (!user) {
        return (
            <div className="site-builder-auth">
                <h2>Sign in to build your website</h2>
                <p>Authentication required to access the website builder.</p>
            </div>
        );
    }

    return (
        <div className="site-builder">
            <div className="site-builder-header">
                <h1>Website Builder</h1>
                <div className="site-builder-actions">
                    <button 
                        onClick={saveSiteConfig}
                        disabled={isLoading}
                        className="save-btn"
                    >
                        {isLoading ? 'Saving...' : '💾 Save Site'}
                    </button>
                    
                    <button 
                        onClick={publishStaticSite}
                        disabled={isLoading || !siteConfig.username}
                        className="publish-btn premium-feature"
                    >
                        {isLoading ? 'Publishing...' : '🚀 Publish Static Site'}
                    </button>
                </div>
            </div>

            {message && (
                <div className={`message ${message.includes('Error') ? 'error' : 'success'}`}>
                    {message}
                </div>
            )}

            <div className="site-builder-content">
                <BlockLibrary 
                    onAddBlock={addBlock}
                    activeTheme={activeTheme}
                    onApplyTheme={applyTheme}
                    siteConfig={siteConfig}
                    setSiteConfig={setSiteConfig}
                />
                
                <LivePreview 
                    siteConfig={siteConfig}
                    selectedBlock={selectedBlock}
                    onSelectBlock={setSelectedBlock}
                    onUpdateBlock={updateBlock}
                    onDeleteBlock={deleteBlock}
                    onMoveBlock={moveBlock}
                    theme={activeTheme}
                />
            </div>
        </div>
    );
};

export default SiteBuilder;