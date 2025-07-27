// ThemeSelector.jsx - Theme selection component

function ThemeSelector({ onApplyTheme, currentTheme }) {
    const [isOpen, setIsOpen] = React.useState(false);
    const [previewTheme, setPreviewTheme] = React.useState(null);

    const themes = [
        { 
            id: 'elegant', 
            name: 'Elegant Classic',
            description: 'Timeless elegance with serif fonts',
            preview: '#D4AF37',
            theme: window.ElegantTheme
        },
        { 
            id: 'boho', 
            name: 'Boho Artistic',
            description: 'Free-spirited with earthy tones',
            preview: '#8B4513',
            theme: window.BohoTheme
        },
        { 
            id: 'coastal', 
            name: 'Coastal Breeze',
            description: 'Ocean-inspired fresh design',
            preview: '#2E86AB',
            theme: window.CoastalTheme
        },
        { 
            id: 'modern', 
            name: 'Modern Minimal',
            description: 'Clean minimalist aesthetics',
            preview: '#2563EB',
            theme: window.ModernTheme
        }
    ];

    const handleThemeSelect = (theme) => {
        if (onApplyTheme && theme.theme) {
            onApplyTheme(theme.theme);
            setIsOpen(false);
            
            // Show celebration animation
            if (window.showCelebration) {
                window.showCelebration(`🎨 ${theme.name} Theme Applied!`, 40);
            }
        }
    };

    const getCurrentThemeName = () => {
        if (!currentTheme?.meta?.name) return 'Custom Theme';
        return currentTheme.meta.name;
    };

    return (
        <div className="theme-selector">
            <button 
                className="theme-toggle-btn"
                onClick={() => setIsOpen(!isOpen)}
                title="Choose a theme for your website"
            >
                <span className="theme-icon">🎨</span>
                <span className="theme-text">
                    <div className="theme-label">Theme</div>
                    <div className="current-theme">{getCurrentThemeName()}</div>
                </span>
                <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>▼</span>
            </button>

            {isOpen && (
                <div className="theme-dropdown">
                    <div className="theme-header">
                        <h3>🎨 Choose Your Theme</h3>
                        <p>Professional pre-designed templates</p>
                    </div>
                    
                    <div className="themes-grid">
                        {themes.map((theme) => (
                            <div 
                                key={theme.id}
                                className={`theme-card ${currentTheme?.meta?.name === theme.name ? 'active' : ''}`}
                                onClick={() => handleThemeSelect(theme)}
                                onMouseEnter={() => setPreviewTheme(theme)}
                                onMouseLeave={() => setPreviewTheme(null)}
                            >
                                <div 
                                    className="theme-preview" 
                                    style={{ backgroundColor: theme.preview }}
                                >
                                    <div className="preview-lines">
                                        <div className="line long"></div>
                                        <div className="line short"></div>
                                        <div className="line medium"></div>
                                    </div>
                                </div>
                                
                                <div className="theme-info">
                                    <h4>{theme.name}</h4>
                                    <p>{theme.description}</p>
                                </div>

                                {currentTheme?.meta?.name === theme.name && (
                                    <div className="active-indicator">✓</div>
                                )}
                            </div>
                        ))}
                    </div>

                    <div className="theme-footer">
                        <button 
                            className="close-btn"
                            onClick={() => setIsOpen(false)}
                        >
                            Close
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .theme-selector {
                    position: relative;
                    z-index: 1000;
                }

                .theme-toggle-btn {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, #D4AF37, #B8941F);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.2);
                    font-family: inherit;
                    width: 100%;
                    min-width: 180px;
                }

                .theme-toggle-btn:hover {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(212, 175, 55, 0.3);
                }

                .theme-icon {
                    font-size: 18px;
                }

                .theme-text {
                    flex: 1;
                    text-align: left;
                }

                .theme-label {
                    font-size: 11px;
                    opacity: 0.9;
                    font-weight: 500;
                }

                .current-theme {
                    font-size: 13px;
                    font-weight: bold;
                }

                .dropdown-arrow {
                    transition: transform 0.3s ease;
                    font-size: 12px;
                }

                .dropdown-arrow.open {
                    transform: rotate(180deg);
                }

                .theme-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
                    padding: 20px;
                    margin-top: 8px;
                    animation: dropdownSlide 0.3s ease;
                    min-width: 320px;
                }

                @keyframes dropdownSlide {
                    from {
                        opacity: 0;
                        transform: translateY(-10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .theme-header {
                    text-align: center;
                    margin-bottom: 20px;
                }

                .theme-header h3 {
                    margin: 0 0 5px 0;
                    color: #1f2937;
                    font-size: 16px;
                }

                .theme-header p {
                    margin: 0;
                    color: #6b7280;
                    font-size: 12px;
                }

                .themes-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .theme-card {
                    border: 2px solid #e5e7eb;
                    border-radius: 8px;
                    padding: 12px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    background: white;
                }

                .theme-card:hover {
                    border-color: #D4AF37;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.15);
                }

                .theme-card.active {
                    border-color: #D4AF37;
                    background: linear-gradient(135deg, #fef7e7, #fef3c7);
                }

                .theme-preview {
                    height: 40px;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                }

                .preview-lines {
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    opacity: 0.7;
                }

                .line {
                    height: 2px;
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 1px;
                }

                .line.long { width: 40px; }
                .line.medium { width: 30px; }
                .line.short { width: 20px; }

                .theme-info h4 {
                    margin: 0 0 4px 0;
                    font-size: 12px;
                    color: #1f2937;
                    font-weight: 600;
                }

                .theme-info p {
                    margin: 0;
                    font-size: 10px;
                    color: #6b7280;
                    line-height: 1.3;
                }

                .active-indicator {
                    position: absolute;
                    top: 8px;
                    right: 8px;
                    background: #10b981;
                    color: white;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 10px;
                    font-weight: bold;
                }

                .theme-footer {
                    text-align: center;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 15px;
                }

                .close-btn {
                    background: #f3f4f6;
                    color: #374151;
                    border: none;
                    padding: 8px 16px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    transition: background 0.2s ease;
                }

                .close-btn:hover {
                    background: #e5e7eb;
                }

                @media (max-width: 768px) {
                    .theme-dropdown {
                        min-width: 280px;
                    }
                    
                    .themes-grid {
                        grid-template-columns: 1fr;
                    }
                }
            `}</style>
        </div>
    );
}

window.ThemeSelector = ThemeSelector;