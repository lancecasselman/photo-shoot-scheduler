// PageManager.jsx - Multi-page navigation and management component

const PageManager = ({ 
    sitePages, 
    activePage, 
    setActivePage, 
    addNewPage, 
    editPageName, 
    togglePageVisibility, 
    deletePage 
}) => {
    return React.createElement(
        'div',
        { className: 'page-manager' },
        
        // Page Navigation Tabs
        React.createElement(
            'div',
            { className: 'page-tabs' },
            React.createElement('h3', null, '📄 Pages'),
            
            // Render page tabs
            ...sitePages.map(page => 
                React.createElement(
                    'div',
                    {
                        key: page.id,
                        className: `page-tab ${activePage === page.id ? 'active' : ''} ${!page.active ? 'hidden' : ''}`,
                        onClick: () => setActivePage(page.id)
                    },
                    React.createElement('span', { className: 'page-name' }, page.name),
                    React.createElement(
                        'div',
                        { className: 'page-actions' },
                        React.createElement(
                            'button',
                            {
                                className: 'page-action-btn edit',
                                onClick: (e) => {
                                    e.stopPropagation();
                                    editPageName(page.id);
                                },
                                title: 'Edit page name'
                            },
                            '✏️'
                        ),
                        React.createElement(
                            'button',
                            {
                                className: 'page-action-btn visibility',
                                onClick: (e) => {
                                    e.stopPropagation();
                                    togglePageVisibility(page.id);
                                },
                                title: page.active ? 'Hide from navigation' : 'Show in navigation'
                            },
                            page.active ? '👁️' : '🚫'
                        ),
                        page.id !== 'home' && React.createElement(
                            'button',
                            {
                                className: 'page-action-btn delete',
                                onClick: (e) => {
                                    e.stopPropagation();
                                    deletePage(page.id);
                                },
                                title: 'Delete page'
                            },
                            '🗑️'
                        )
                    )
                )
            ),
            
            // Add New Page Button
            React.createElement(
                'button',
                {
                    className: 'add-page-btn',
                    onClick: addNewPage
                },
                '+ Add Page'
            )
        ),
        
        // Current Page Info
        React.createElement(
            'div',
            { className: 'current-page-info' },
            React.createElement('h4', null, `Editing: ${sitePages.find(p => p.id === activePage)?.name || activePage}`),
            React.createElement('small', null, `URL: ${sitePages.find(p => p.id === activePage)?.url || '/' + activePage}`)
        )
    );
};

// Make component globally available
// Add page validation and debugging
window.debugPageContent = function(siteBlocks) {
    console.log('=== PAGE CONTENT DEBUG ===');
    Object.keys(siteBlocks).forEach(pageId => {
        const blocks = siteBlocks[pageId];
        console.log(`Page: ${pageId}`);
        console.log(`  - Blocks: ${Array.isArray(blocks) ? blocks.length : 'Invalid'}`);
        if (Array.isArray(blocks)) {
            blocks.forEach((block, index) => {
                console.log(`  - Block ${index}: ${block.type || 'No type'} (ID: ${block.id || 'No ID'})`);
            });
        }
    });
    console.log('=== END DEBUG ===');
};

window.PageManager = PageManager;