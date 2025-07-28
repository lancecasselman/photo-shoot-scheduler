// PageNavigator.jsx - Multi-page navigation component

function PageNavigator({ currentPage, setPage, siteBlocks }) {
    const pages = [
        { id: 'home', label: 'Home', icon: '🏠' },
        { id: 'about', label: 'About Me', icon: '👨‍🎨' },
        { id: 'gallery', label: 'Gallery', icon: '📸' },
        { id: 'contact', label: 'Contact', icon: '📧' }
    ];

    const getPageBlockCount = (pageId) => {
        return siteBlocks[pageId]?.length || 0;
    };

    return React.createElement(
        'div',
        { className: 'page-navigator' },
        React.createElement(
            'div',
            { className: 'nav-header' },
            React.createElement('h3', null, '📄 Site Pages'),
            React.createElement('div', { className: 'nav-subtitle' }, 'Build your multi-page website')
        ),
        
        React.createElement(
            'div',
            { className: 'page-tabs' },
            pages.map((page) => 
                React.createElement(
                    'button',
                    {
                        key: page.id,
                        onClick: () => setPage(page.id),
                        className: `page-tab ${page.id === currentPage ? 'active' : ''}`,
                        title: `Edit ${page.label} page`
                    },
                    React.createElement('span', { className: 'page-icon' }, page.icon),
                    React.createElement('span', { className: 'page-label' }, page.label),
                    React.createElement('span', { className: 'block-count' }, getPageBlockCount(page.id))
                )
            )
        ),

        React.createElement(
            'div',
            { className: 'current-page-info' },
            React.createElement(
                'div',
                { className: 'editing-indicator' },
                '✏️ Editing: ',
                React.createElement('strong', null, pages.find(p => p.id === currentPage)?.label)
            ),
            React.createElement(
                'div',
                { className: 'page-blocks-count' },
                `${getPageBlockCount(currentPage)} blocks on this page`
            )
        ),

        React.createElement('style', { dangerouslySetInnerHTML: { __html: `
                .page-navigator {
                    background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
                    border-radius: 12px;
                    padding: 20px;
                    margin-bottom: 20px;
                    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
                }

                .nav-header {
                    text-align: center;
                    margin-bottom: 15px;
                }

                .nav-header h3 {
                    margin: 0;
                    color: #1f2937;
                    font-size: 18px;
                    font-weight: bold;
                }

                .nav-subtitle {
                    color: #6b7280;
                    font-size: 12px;
                    margin-top: 2px;
                }

                .page-tabs {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 10px;
                    margin-bottom: 15px;
                }

                .page-tab {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding: 12px 8px;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    background: white;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    min-height: 70px;
                }

                .page-tab:hover {
                    border-color: #D4AF37;
                    box-shadow: 0 2px 8px rgba(212, 175, 55, 0.2);
                    transform: translateY(-1px);
                }

                .page-tab.active {
                    border-color: #D4AF37;
                    background: linear-gradient(135deg, #D4AF37, #B8941F);
                    color: white;
                    box-shadow: 0 4px 12px rgba(212, 175, 55, 0.3);
                }

                .page-icon {
                    font-size: 20px;
                    margin-bottom: 4px;
                }

                .page-label {
                    font-size: 11px;
                    font-weight: bold;
                    text-align: center;
                    line-height: 1.2;
                }

                .block-count {
                    position: absolute;
                    top: -5px;
                    right: -5px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 18px;
                    height: 18px;
                    font-size: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: bold;
                }

                .page-tab.active .block-count {
                    background: #dc2626;
                }

                .current-page-info {
                    background: rgba(255, 255, 255, 0.8);
                    border-radius: 8px;
                    padding: 10px;
                    text-align: center;
                }

                .editing-indicator {
                    font-size: 12px;
                    color: #1f2937;
                    margin-bottom: 2px;
                }

                .page-blocks-count {
                    font-size: 10px;
                    color: #6b7280;
                }

                @media (max-width: 768px) {
                    .page-tabs {
                        grid-template-columns: repeat(4, 1fr);
                        gap: 5px;
                    }

                    .page-tab {
                        padding: 8px 4px;
                        min-height: 60px;
                    }

                    .page-icon {
                        font-size: 16px;
                    }

                    .page-label {
                        font-size: 9px;
                    }
                }
            ` } })
    );
}

window.PageNavigator = PageNavigator;