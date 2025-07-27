// Block Library - Sidebar Component for Website Builder
import React from 'react';

const BlockLibrary = ({ 
    onAddBlock, 
    activeTheme, 
    onApplyTheme, 
    siteConfig, 
    setSiteConfig 
}) => {
    const blockTypes = [
        { 
            type: 'heading', 
            icon: '📝', 
            name: 'Heading',
            description: 'Add a title or heading text'
        },
        { 
            type: 'paragraph', 
            icon: '📄', 
            name: 'Paragraph',
            description: 'Add body text or content'
        },
        { 
            type: 'image', 
            icon: '🖼️', 
            name: 'Image',
            description: 'Add photos or graphics'
        },
        { 
            type: 'button', 
            icon: '🔘', 
            name: 'Button',
            description: 'Add clickable call-to-action'
        }
    ];

    const themes = [
        { 
            id: 'classic', 
            name: 'Classic Gold', 
            color: '#D4AF37',
            description: 'Elegant gold theme for luxury photography'
        },
        { 
            id: 'modern', 
            name: 'Modern Blue', 
            color: '#2563EB',
            description: 'Clean modern design with blue accents'
        },
        { 
            id: 'dark', 
            name: 'Dark Mode', 
            color: '#10B981',
            description: 'Dark background with green highlights'
        },
        { 
            id: 'bold', 
            name: 'Bold Headlines', 
            color: '#DC2626',
            description: 'Strong red theme for impactful messaging'
        }
    ];

    const handleUsernameChange = (e) => {
        const username = e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '');
        setSiteConfig(prev => ({ ...prev, username }));
    };

    const handleBrandColorChange = (e) => {
        setSiteConfig(prev => ({ ...prev, brandColor: e.target.value }));
    };

    const handleFontFamilyChange = (e) => {
        setSiteConfig(prev => ({ ...prev, fontFamily: e.target.value }));
    };

    return (
        <div className="block-library">
            <div className="library-section">
                <h3>Add Blocks</h3>
                <div className="block-types">
                    {blockTypes.map(block => (
                        <div 
                            key={block.type}
                            className="block-type"
                            onClick={() => onAddBlock(block.type)}
                        >
                            <div className="block-icon">{block.icon}</div>
                            <div className="block-info">
                                <div className="block-name">{block.name}</div>
                                <div className="block-description">{block.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="library-section">
                <h3>Themes</h3>
                <div className="themes">
                    {themes.map(theme => (
                        <div 
                            key={theme.id}
                            className={`theme-option ${activeTheme === theme.id ? 'active' : ''}`}
                            onClick={() => onApplyTheme(theme.id)}
                        >
                            <div 
                                className="theme-color"
                                style={{ backgroundColor: theme.color }}
                            ></div>
                            <div className="theme-info">
                                <div className="theme-name">{theme.name}</div>
                                <div className="theme-description">{theme.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="library-section">
                <h3>Site Settings</h3>
                
                <div className="setting-group">
                    <label htmlFor="username">Username</label>
                    <input
                        id="username"
                        type="text"
                        value={siteConfig.username}
                        onChange={handleUsernameChange}
                        placeholder="yoursite"
                        className="setting-input"
                    />
                    <small>Your site will be: /site/{siteConfig.username}</small>
                </div>

                <div className="setting-group">
                    <label htmlFor="brandColor">Brand Color</label>
                    <div className="color-input-group">
                        <input
                            id="brandColor"
                            type="color"
                            value={siteConfig.brandColor}
                            onChange={handleBrandColorChange}
                            className="color-input"
                        />
                        <input
                            type="text"
                            value={siteConfig.brandColor}
                            onChange={handleBrandColorChange}
                            className="color-text"
                        />
                    </div>
                </div>

                <div className="setting-group">
                    <label htmlFor="fontFamily">Font Family</label>
                    <select
                        id="fontFamily"
                        value={siteConfig.fontFamily}
                        onChange={handleFontFamilyChange}
                        className="setting-select"
                    >
                        <option value="Inter, sans-serif">Inter (Modern)</option>
                        <option value="Georgia, serif">Georgia (Classic)</option>
                        <option value="Roboto, sans-serif">Roboto (Clean)</option>
                        <option value="Montserrat, sans-serif">Montserrat (Bold)</option>
                        <option value="Playfair Display, serif">Playfair (Elegant)</option>
                        <option value="Open Sans, sans-serif">Open Sans (Friendly)</option>
                    </select>
                </div>

                <div className="setting-group">
                    <label htmlFor="customDomain">Custom Domain (Premium)</label>
                    <input
                        id="customDomain"
                        type="text"
                        value={siteConfig.customDomain}
                        onChange={(e) => setSiteConfig(prev => ({ ...prev, customDomain: e.target.value }))}
                        placeholder="yoursite.com"
                        className="setting-input premium-feature"
                        disabled
                    />
                    <small>Upgrade to Premium for custom domains</small>
                </div>
            </div>

            <div className="library-section">
                <h3>Tips</h3>
                <div className="tips">
                    <div className="tip">
                        💡 <strong>Drag blocks</strong> to reorder them in your design
                    </div>
                    <div className="tip">
                        🎨 <strong>Click any block</strong> to edit its content and styling
                    </div>
                    <div className="tip">
                        💾 <strong>Save frequently</strong> to preserve your work
                    </div>
                    <div className="tip">
                        🚀 <strong>Publish</strong> creates a public static website
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BlockLibrary;