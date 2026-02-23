module.exports = ({ useState, useEffect, useWindow, useComponents, api, __dirname }) => {
    
    useWindow().setTitle('DevTools');
    
    const { 
        PrimaryButton, SecondaryButton,
        Section, SectionTitle, PageTitle, Row, Label, ScrollContainer, FlexRow,
        Card,
        Icons
    } = useComponents();
    
    const [activeTab, setActiveTab] = useState('api');
    const [apiMethods, setApiMethods] = useState({});
    const [expandedItems, setExpandedItems] = useState({});
    const [scanCount, setScanCount] = useState(0);
    const [scanDirectory, setScanDirectory] = useState('');
    const [availableDirectories, setAvailableDirectories] = useState([]);
    const [fileSizeData, setFileSizeData] = useState({
        totalSize: 0,
        directoryCount: 0,
        fileCount: 0,
        fileTypes: {}
    });
    const [systemInfo, setSystemInfo] = useState({});
    const [projectFolders, setProjectFolders] = useState([]);
    const [selectedProject, setSelectedProject] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(false);
    const [restartMessage, setRestartMessage] = useState('');
    const [expansions, setExpansions] = useState([]);
    const [electronLogs, setElectronLogs] = useState([]);
    const [showConsole, setShowConsole] = useState(false);
    
    useEffect(() => {
        performScan();
        loadAvailableDirectories();
        loadSystemInfo();
    }, []);
    
    const loadAvailableDirectories = async () => {
        try {
            const result = await api.expansion.call('listSubdirectories');
            if (result.success) {
                setAvailableDirectories(result.directories);
                if (result.directories.length > 0) {
                    setScanDirectory(result.directories[0]);
                }
            }
        } catch (e) {
            console.error('Error loading directories:', e);
        }
    };

    const loadSystemInfo = async () => {
        try {
            const result = await api.expansion.call('getSystemInfo');
            if (result.success) {
                setSystemInfo(result);
            }
        } catch (e) {
            console.error('Error loading system info:', e);
        }
    };
    
    const refreshScan = () => {
        performScan();
    };

    const loadProjectFolders = async () => {
        setLoadingProjects(true);
        try {
            const result = await api.expansion.call('listProjectFolders');
            if (result.success) {
                setProjectFolders(result.projects || []);
                if (result.projects && result.projects.length > 0 && !selectedProject) {
                    setSelectedProject(result.projects[0]);
                }
            }
        } catch (e) {
            console.error('Error loading project folders:', e);
        }
        setLoadingProjects(false);
    };

    const loadServerInfo = async (projectFolder) => {
        try {
            const result = await api.expansion.call('getServerInfoForProject', projectFolder);
            if (result.success) {
                setSystemInfo(result);
            }
        } catch (e) {
            console.error('Error loading server info:', e);
        }
    };

    useEffect(() => {
        if (activeTab === 'environment' && projectFolders.length === 0) {
            loadProjectFolders();
        }
    }, [activeTab]);

    useEffect(() => {
        if (selectedProject) {
            loadServerInfo(selectedProject);
        }
    }, [selectedProject]);
    
    const performScan = () => {
        // Collect properties including non-enumerable and prototype chain.
        const getAllProperties = (obj) => {
            const props = new Set();
            let current = obj;
            let depth = 0;
            while (current && depth < 10) {
                try {
                    Object.getOwnPropertyNames(current).forEach(p => props.add(p));
                } catch (e) {}
                try {
                    Object.getOwnPropertySymbols(current).forEach(p => {
                        try {
                            props.add(String(p));
                        } catch (e) {}
                    });
                } catch (e) {}
                try {
                    current = Object.getPrototypeOf(current);
                    depth++;
                } catch (e) {
                    break;
                }
                if (!current || current === Object.prototype || current === Function.prototype) break;
            }
            return Array.from(props).filter(p => p && p !== 'constructor');
        };
        
        const methods = {};
        const allApiProps = getAllProperties(api);
        
        for (let key of allApiProps) {
            try {
                const val = api[key];
                if (typeof val === 'function') {
                    methods[key] = 'function';
                } else if (typeof val === 'object' && val !== null) {
                    const allKeys = getAllProperties(val);
                    const nestedInfo = {};
                    for (let subkey of allKeys) {
                        try {
                            const subval = val[subkey];
                            if (typeof subval === 'function') {
                                const funcProps = getAllProperties(subval);
                                nestedInfo[subkey] = { type: 'function', keys: funcProps };
                            } else if (typeof subval === 'object' && subval !== null) {
                                const deepKeys = getAllProperties(subval);
                                nestedInfo[subkey] = { type: 'object', keys: deepKeys };
                            } else {
                                nestedInfo[subkey] = typeof subval;
                            }
                        } catch (e) {}
                    }
                    methods[key] = { type: 'object', keys: allKeys, nested: nestedInfo };
                } else {
                    methods[key] = typeof val;
                }
            } catch (e) {}
        }
        setApiMethods(methods);
        setScanCount(c => c + 1);
        scanFileSizes();
    };

    const scanFileSizes = async (dir = scanDirectory) => {
        try {
            const result = await api.expansion.call('scanFileSizes', dir);
            if (result.success) {
                setFileSizeData({
                    totalSize: result.totalSize,
                    directoryCount: result.directoryCount,
                    fileCount: result.fileCount,
                    fileTypes: result.fileTypes
                });
            } else {
                console.error('Error scanning file sizes:', result.error);
            }
        } catch (e) {
            console.error('Error calling scanFileSizes:', e);
        }
    };
    
    return (
        <ScrollContainer>
            <div style={{ marginTop: '12px', padding: '0 20px' }}>
                <Section>
                    <PageTitle style={{ margin: '0 0 8px 0' }}><Icons.Wrench size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> DevTools</PageTitle>
                    {activeTab === 'api' && (
                        <div style={{ fontSize: '11px', color: '#888' }}>
                            Found {Object.keys(apiMethods).length} API modules (scan #{scanCount})
                        </div>
                    )}
                </Section>
                <Section>
                    <FlexRow gap="8px" wrap={true}>
                        <SecondaryButton 
                            onClick={() => setActiveTab('api')}
                            style={activeTab === 'api' ? { background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' } : {}}
                        >
                            <Icons.Code size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> API
                        </SecondaryButton>
                        <SecondaryButton 
                            onClick={() => setActiveTab('filesize')}
                            style={activeTab === 'filesize' ? { background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' } : {}}
                        >
                            <Icons.BarChart3 size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> File Size
                        </SecondaryButton>
                        <SecondaryButton 
                            onClick={() => setActiveTab('environment')}
                            style={activeTab === 'environment' ? { background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' } : {}}
                        >
                            <Icons.HardDrive size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Environment
                        </SecondaryButton>
                        <SecondaryButton 
                            onClick={() => setActiveTab('tools')}
                            style={activeTab === 'tools' ? { background: 'rgba(99, 102, 241, 0.2)', color: '#6366f1' } : {}}
                        >
                            <Icons.Wrench size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Tools
                        </SecondaryButton>
                        {(activeTab === 'api' || activeTab === 'filesize' || activeTab === 'environment') && (
                            <SecondaryButton onClick={refreshScan}>
                                <Icons.RotateCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Refresh
                            </SecondaryButton>
                        )}
                    </FlexRow>
                </Section>
                
                {activeTab === 'api' && (
                    <Section>
                        <SectionTitle>Available API Methods</SectionTitle>
                        <div style={{
                            backgroundColor: '#0f1419',
                            padding: '12px',
                            borderRadius: '6px',
                            fontFamily: 'monospace',
                            fontSize: '12px',
                            maxHeight: '250px',
                            overflow: 'auto',
                            color: '#00ff00',
                            marginBottom: '20px'
                        }}>
                            {Object.keys(apiMethods).length === 0 ? (
                                <div style={{ color: '#999' }}>No API methods detected</div>
                            ) : (
                                Object.entries(apiMethods).map(([key, type]) => {
                                    const isExpandable = typeof type === 'object' && type.keys && type.keys.length > 0;
                                    const isExpanded = expandedItems[key];
                                    
                                    return (
                                        <div key={key} style={{ marginBottom: '4px' }}>
                                            <div style={{ paddingBottom: '8px', borderBottom: '1px solid #2d2d30' }}>
                                                {isExpandable && (
                                                    <button
                                                        onClick={() => setExpandedItems({
                                                            ...expandedItems,
                                                            [key]: !isExpanded
                                                        })}
                                                        style={{
                                                            background: 'none',
                                                            border: 'none',
                                                            color: '#00ffff',
                                                            cursor: 'pointer',
                                                            fontSize: 'inherit',
                                                            fontFamily: 'inherit',
                                                            padding: '0',
                                                            marginRight: '4px'
                                                        }}
                                                    >
                                                        {isExpanded ? '▼' : '▶'}
                                                    </button>
                                                )}
                                                {!isExpandable && <span style={{ marginRight: '16px' }}>·</span>}
                                                <span style={{ color: '#00ffff' }}>api.{key}</span>
                                                <span style={{ color: '#888' }}> : </span>
                                                <span style={{ color: '#ffff00' }}>
                                                    {typeof type === 'string' ? type : type.type}
                                                </span>
                                            </div>
                                            {isExpandable && isExpanded && (
                                                <div style={{ marginLeft: '20px', marginTop: '8px', marginBottom: '12px' }}>
                                                    {type.keys.map((subkey, idx) => {
                                                        const nestedType = type.nested ? type.nested[subkey] : null;
                                                        const isNestedExpandable = nestedType && typeof nestedType === 'object' && nestedType.keys && nestedType.keys.length > 0;
                                                        const isNestedExpanded = expandedItems[key + '_' + subkey];
                                                        
                                                        return (
                                                            <div key={idx}>
                                                                <div style={{ 
                                                                    marginBottom: '4px',
                                                                    color: '#00ff00',
                                                                    fontSize: '11px',
                                                                    paddingLeft: '12px',
                                                                    borderLeft: '2px solid #3e3e42'
                                                                }}>
                                                                    {isNestedExpandable && (
                                                                        <button
                                                                            onClick={() => setExpandedItems({
                                                                                ...expandedItems,
                                                                                [key + '_' + subkey]: !isNestedExpanded
                                                                            })}
                                                                            style={{
                                                                                background: 'none',
                                                                                border: 'none',
                                                                                color: '#90ee90',
                                                                                cursor: 'pointer',
                                                                                fontSize: 'inherit',
                                                                                fontFamily: 'inherit',
                                                                                padding: '0',
                                                                                marginRight: '4px'
                                                                            }}
                                                                        >
                                                                            {isNestedExpanded ? '▼' : '▶'}
                                                                        </button>
                                                                    )}
                                                                    {!isNestedExpandable && <span style={{ marginRight: '16px' }}>·</span>}
                                                                    <span style={{ color: '#90ee90' }}>→ {subkey}</span>
                                                                    {nestedType && typeof nestedType === 'string' && (
                                                                        <span style={{ color: '#888', marginLeft: '8px' }}>: {nestedType}</span>
                                                                    )}
                                                                    {nestedType && typeof nestedType === 'object' && (
                                                                        <span style={{ color: '#888', marginLeft: '8px' }}>: {nestedType.type}</span>
                                                                    )}
                                                                </div>
                                                                {isNestedExpandable && isNestedExpanded && nestedType.keys && (
                                                                    <div style={{ marginLeft: '32px', marginBottom: '8px' }}>
                                                                        {nestedType.keys.map((deepkey, didx) => (
                                                                            <div key={didx} style={{
                                                                                marginBottom: '2px',
                                                                                color: '#00ff00',
                                                                                fontSize: '10px',
                                                                                paddingLeft: '12px',
                                                                                borderLeft: '2px solid #3e3e42',
                                                                                color: '#a0ffa0'
                                                                            }}>
                                                                                ╰─ {deepkey}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </Section>
                )}
                
                {activeTab === 'filesize' && (
                    <Section>
                        <SectionTitle>File Size Checker</SectionTitle>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <Label>Select Directory</Label>
                            <FlexRow gap="8px" wrap={false} style={{ marginTop: '8px' }}>
                                <select 
                                    value={scanDirectory}
                                    onChange={(e) => setScanDirectory(e.target.value)}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        backgroundColor: '#1a1f2e',
                                        color: '#ccc',
                                        border: '1px solid #3e3e42',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        fontFamily: 'inherit'
                                    }}
                                >
                                    {availableDirectories.map(dir => (
                                        <option key={dir} value={dir}>{dir}</option>
                                    ))}
                                </select>
                                <SecondaryButton onClick={() => scanFileSizes(scanDirectory)}>
                                    <Icons.RotateCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Scan
                                </SecondaryButton>
                            </FlexRow>
                        </div>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px', marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>Total Size</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00ff00', marginTop: '4px' }}>
                                    {fileSizeData.totalSize > 1024 * 1024
                                        ? (fileSizeData.totalSize / (1024 * 1024)).toFixed(2) + ' MB'
                                        : fileSizeData.totalSize > 1024
                                        ? (fileSizeData.totalSize / 1024).toFixed(2) + ' KB'
                                        : fileSizeData.totalSize + ' B'}
                                </div>
                            </div>
                            
                            <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>Total Files</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#ffff00', marginTop: '4px' }}>
                                    {fileSizeData.fileCount}
                                </div>
                            </div>
                            
                            <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>Total Directories</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#0fff0f', marginTop: '4px' }}>
                                    {fileSizeData.directoryCount}
                                </div>
                            </div>
                            
                            <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888' }}>File Types</div>
                                <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#00d4ff', marginTop: '4px' }}>
                                    {Object.keys(fileSizeData.fileTypes).length}
                                </div>
                            </div>
                        </div>

                        <div style={{ marginTop: '20px', backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ccc', marginBottom: '8px' }}>File Types Breakdown</div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                                {Object.entries(fileSizeData.fileTypes)
                                    .sort((a, b) => b[1] - a[1])
                                    .map(([ext, count]) => (
                                        <div key={ext} style={{ 
                                            backgroundColor: '#0f1419',
                                            padding: '8px 12px',
                                            borderRadius: '3px',
                                            fontSize: '11px',
                                            border: '1px solid #2d2d30'
                                        }}>
                                            <span style={{ color: '#00ff00' }}>{ext}</span>
                                            <span style={{ color: '#888', marginLeft: '6px' }}>× {count}</span>
                                        </div>
                                    ))}
                            </div>
                        </div>

                        {Object.keys(fileSizeData.fileTypes).length > 0 && (
                            <div style={{ marginTop: '20px', marginBottom: '20px', backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42', textAlign: 'center' }}>
                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#ccc', marginBottom: '12px' }}>File Type Distribution</div>
                                <svg width="250" height="250" viewBox="0 0 300 300" style={{ margin: '0 auto', display: 'block', maxWidth: '100%' }}>
                                    {(() => {
                                        const types = Object.entries(fileSizeData.fileTypes);
                                        const total = types.reduce((sum, [_, count]) => sum + count, 0);
                                        const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd93d', '#6bcf7f', '#ff8c42', '#ff6b9d', '#c06c84'];
                                        let currentAngle = -Math.PI / 2;

                                        return types.map(([ext, count], idx) => {
                                            const sliceAngle = (count / total) * 2 * Math.PI;
                                            const startAngle = currentAngle;
                                            const endAngle = currentAngle + sliceAngle;
                                            const midAngle = (startAngle + endAngle) / 2;

                                            const x1 = 150 + 100 * Math.cos(startAngle);
                                            const y1 = 150 + 100 * Math.sin(startAngle);
                                            const x2 = 150 + 100 * Math.cos(endAngle);
                                            const y2 = 150 + 100 * Math.sin(endAngle);

                                            const largeArc = sliceAngle > Math.PI ? 1 : 0;
                                            const pathData = [
                                                `M 150 150`,
                                                `L ${x1} ${y1}`,
                                                `A 100 100 0 ${largeArc} 1 ${x2} ${y2}`,
                                                'Z'
                                            ].join(' ');

                                            currentAngle = endAngle;

                                            return (
                                                <path
                                                    key={idx}
                                                    d={pathData}
                                                    fill={colors[idx % colors.length]}
                                                    stroke="#0f1419"
                                                    strokeWidth="2"
                                                />
                                            );
                                        });
                                    })()}
                                </svg>
                                <div style={{ marginTop: '12px', display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
                                    {Object.entries(fileSizeData.fileTypes)
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([ext, count], idx) => {
                                            const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#ffd93d', '#6bcf7f', '#ff8c42', '#ff6b9d', '#c06c84'];
                                            const percentage = ((count / Object.values(fileSizeData.fileTypes).reduce((sum, c) => sum + c, 0)) * 100).toFixed(1);
                                            return (
                                                <div key={ext} style={{ fontSize: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div style={{ width: '12px', height: '12px', backgroundColor: colors[idx % colors.length], borderRadius: '2px' }}></div>
                                                    <span style={{ color: '#ccc' }}>{ext} ({percentage}%)</span>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        )}
                    </Section>
                )}

                {activeTab === 'environment' && (
                    <Section>
                        <SectionTitle><Icons.Server size={18} style={{ marginRight: '8px', verticalAlign: 'middle' }} /> Minecraft Server Info</SectionTitle>
                        
                        <div style={{ marginBottom: '20px' }}>
                            <Label>Select Project Folder</Label>
                            <FlexRow gap="8px" wrap={false} style={{ marginTop: '8px' }}>
                                <select 
                                    value={selectedProject}
                                    onChange={(e) => setSelectedProject(e.target.value)}
                                    disabled={loadingProjects || projectFolders.length === 0}
                                    style={{
                                        flex: 1,
                                        padding: '8px 12px',
                                        backgroundColor: '#1a1f2e',
                                        color: projectFolders.length === 0 ? '#666' : '#ccc',
                                        border: '1px solid #3e3e42',
                                        borderRadius: '4px',
                                        fontSize: '13px',
                                        fontFamily: 'inherit',
                                        cursor: projectFolders.length === 0 ? 'not-allowed' : 'pointer'
                                    }}
                                >
                                    {projectFolders.length === 0 ? (
                                        <option>No projects found</option>
                                    ) : (
                                        projectFolders.map(folder => (
                                            <option key={folder} value={folder}>{folder}</option>
                                        ))
                                    )}
                                </select>
                                <SecondaryButton 
                                    onClick={loadProjectFolders}
                                    disabled={loadingProjects}
                                >
                                    <Icons.RotateCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Refresh
                                </SecondaryButton>
                            </FlexRow>
                            {projectFolders.length === 0 && !loadingProjects && (
                                <div style={{ fontSize: '11px', color: '#666', marginTop: '6px' }}>
                                    Looking for Projects folder one level back from Expansions...
                                </div>
                            )}
                        </div>

                        {selectedProject && systemInfo.success && systemInfo.server?.found ? (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Server Type</div>
                                    <div style={{ fontSize: '14px', color: '#00ff00', fontFamily: 'monospace' }}>{systemInfo.server.type}</div>
                                </div>

                                <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>MC Version</div>
                                    <div style={{ fontSize: '14px', color: '#ffff00', fontFamily: 'monospace' }}>{systemInfo.server.version}</div>
                                </div>

                                <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Installed Plugins</div>
                                    <div style={{ fontSize: '14px', color: '#0fff0f', fontFamily: 'monospace' }}>{systemInfo.server.pluginCount} plugins</div>
                                </div>

                                <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Status</div>
                                    <div style={{ fontSize: '14px', color: '#00d4ff', fontFamily: 'monospace' }}><Icons.CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />Ready</div>
                                </div>

                                <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42', gridColumn: '1 / -1' }}>
                                    <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Plugins Directory</div>
                                    <div style={{ fontSize: '11px', fontFamily: 'monospace', color: '#ccc', wordBreak: 'break-all' }}>{systemInfo.server.pluginsDir}</div>
                                </div>

                                {systemInfo.server.plugins && systemInfo.server.plugins.length > 0 && (
                                    <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42', gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Loaded Plugins {systemInfo.server.pluginCount > 20 ? `(showing first 20 of ${systemInfo.server.pluginCount})` : ''}</div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                            {systemInfo.server.plugins.map((plugin, idx) => (
                                                <div key={idx} style={{
                                                    backgroundColor: '#0f1419',
                                                    padding: '6px 10px',
                                                    borderRadius: '3px',
                                                    fontSize: '11px',
                                                    border: '1px solid #2d2d30',
                                                    color: '#00ff00',
                                                    maxWidth: '100%',
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    whiteSpace: 'nowrap'
                                                }}>
                                                    {plugin}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {systemInfo.server.properties && Object.keys(systemInfo.server.properties).length > 0 && (
                                    <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42', gridColumn: '1 / -1' }}>
                                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Server Properties</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                                            {Object.entries(systemInfo.server.properties)
                                                .filter(([key]) => ['motd', 'difficulty', 'max-players', 'pvp', 'spawn-protection', 'gamemode', 'level-name', 'online-mode', 'enable-command-block', 'server-port', 'server-ip'].includes(key))
                                                .sort(([a], [b]) => {
                                                    const order = { 'server-ip': 0, 'server-port': 1 };
                                                    return (order[a] ?? 2) - (order[b] ?? 2);
                                                })
                                                .map(([key, value], idx) => (
                                                    <div key={idx} style={{ padding: '8px', backgroundColor: '#0f1419', borderRadius: '3px', border: '1px solid #2d2d30' }}>
                                                        <div style={{ fontSize: '10px', color: '#888', marginBottom: '2px' }}>{key}</div>
                                                        <div style={{ color: '#00ff00', fontFamily: 'monospace', wordBreak: 'break-word' }}>{value}</div>
                                                    </div>
                                                ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : selectedProject && (!systemInfo.success || !systemInfo.server?.found) ? (
                            <div style={{ backgroundColor: '#1a1f2e', padding: '20px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ color: '#888', marginBottom: '12px' }}>
                                    <Icons.AlertCircle size={20} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                </div>
                                <div style={{ color: '#ddd', marginBottom: '12px' }}>
                                    No Minecraft server detected in <strong>{selectedProject}</strong>
                                </div>
                                
                                <div style={{ backgroundColor: '#0f1419', padding: '12px', borderRadius: '4px', border: '1px solid #2d2d30', marginTop: '12px' }}>
                                    <div style={{ fontSize: '11px', color: '#888', fontFamily: 'monospace', lineHeight: '1.5' }}>
                                        <div><strong>Debug Info:</strong></div>
                                        {systemInfo.debug && (
                                            <>
                                                <div style={{ marginTop: '8px', color: '#00ff00' }}>Project Path:</div>
                                                <div style={{ marginLeft: '12px', color: '#ccc', wordBreak: 'break-all' }}>{systemInfo.debug.projectPath}</div>
                                                
                                                <div style={{ marginTop: '8px', color: '#00ff00' }}>Project Exists:</div>
                                                <div style={{ marginLeft: '12px', color: systemInfo.debug.projectPathExists ? '#00ff00' : '#ff6b6b' }}>
                                                    {systemInfo.debug.projectPathExists ? 'Yes ✓' : 'No ✗'}
                                                </div>
                                                
                                                <div style={{ marginTop: '8px', color: '#00ff00' }}>Environment Folder Exists:</div>
                                                <div style={{ marginLeft: '12px', color: systemInfo.debug.environmentPathExists ? '#00ff00' : '#ffff00' }}>
                                                    {systemInfo.debug.environmentPathExists ? 'Yes ✓' : 'No (not found)'}
                                                </div>

                                                {systemInfo.debug.environmentPathExists && systemInfo.debug.filesInEnvironmentPath && systemInfo.debug.filesInEnvironmentPath.length > 0 && (
                                                    <>
                                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Files/Folders in Environment:</div>
                                                        <div style={{ marginLeft: '12px', color: '#ccc', maxHeight: '120px', overflow: 'auto' }}>
                                                            {systemInfo.debug.filesInEnvironmentPath.map((file, idx) => (
                                                                <div key={idx} style={{ fontSize: '10px' }}>• {file}</div>
                                                            ))}
                                                        </div>
                                                    </>
                                                )}

                                {systemInfo.debug.environmentSubfolders && systemInfo.debug.environmentSubfolders.length > 0 && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Environment Subfolders Found:</div>
                                        <div style={{ marginLeft: '12px', color: '#ccc' }}>
                                            {systemInfo.debug.environmentSubfolders.map((folder, idx) => (
                                                <div key={idx} style={{ fontSize: '10px' }}>• {folder}</div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div style={{ marginTop: '8px', color: '#00ff00' }}>Searching In:</div>
                                <div style={{ marginLeft: '12px', color: '#ffd93d', fontWeight: 'bold' }}>
                                    {systemInfo.debug.searchingIn}
                                </div>

                                {systemInfo.debug.detectedFromDir && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Detected From Dir:</div>
                                        <div style={{ marginLeft: '12px', color: '#00d4ff', fontFamily: 'monospace', fontSize: '10px' }}>
                                            {systemInfo.debug.detectedFromDir}
                                        </div>
                                    </>
                                )}

                                {systemInfo.debug.detectionMethod && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Detection Method:</div>
                                        <div style={{ marginLeft: '12px', color: '#ffd93d', fontSize: '10px' }}>
                                            {systemInfo.debug.detectionMethod}
                                        </div>
                                    </>
                                )}

                                {systemInfo.debug.jarSearchPath && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Jar Search Path:</div>
                                        <div style={{ marginLeft: '12px', color: '#ccc', wordBreak: 'break-all', fontSize: '10px' }}>
                                            {systemInfo.debug.jarSearchPath}
                                        </div>
                                    </>
                                )}
                                
                                {systemInfo.debug.checkedPaths && systemInfo.debug.checkedPaths.length > 0 && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#00ff00' }}>Checked Plugin Paths:</div>
                                        <div style={{ marginLeft: '12px', fontSize: '10px', maxHeight: '150px', overflow: 'auto' }}>
                                            {systemInfo.debug.checkedPaths.map((check, idx) => (
                                                <div key={idx} style={{ color: check.exists ? '#00ff00' : '#666', marginBottom: '2px' }}>
                                                    {check.exists ? '✓' : '✗'} {check.path}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                                
                                {systemInfo.debug.error && (
                                    <>
                                        <div style={{ marginTop: '8px', color: '#ff6b6b' }}>Error:</div>
                                        <div style={{ marginLeft: '12px', color: '#ff6b6b', fontSize: '10px', wordBreak: 'break-all' }}>
                                            {systemInfo.debug.error}
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                                </div>
                            </div>
                        ) : (
                    <div style={{ backgroundColor: '#1a1f2e', padding: '20px', borderRadius: '4px', border: '1px solid #3e3e42', textAlign: 'center' }}>
                        <div style={{ color: '#888' }}>
                            {projectFolders.length === 0 ? (
                                <>
                                    <Icons.AlertCircle size={24} style={{ marginRight: '8px', verticalAlign: 'middle' }} />
                                    <div style={{ marginTop: '8px' }}>No Projects folder found</div>
                                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                                        Looking for a "Projects" folder one directory level back from Expansions
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div>Select a project to view server info</div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                    </Section>
                )}

                {activeTab === 'tools' && (
                    <Section>
                        <SectionTitle>DevTools Functions</SectionTitle>
                        
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ backgroundColor: '#1a1f2e', padding: '16px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>Expansion Management</div>
                                <SecondaryButton 
                                    onClick={async () => {
                                        try {
                                            const result = await api.expansion.call('getExpansionInfo');
                                            setExpansions(result.expansions || []);
                                            setRestartMessage(`Found ${result.count} expansions`);
                                        } catch (e) {
                                            setRestartMessage('Error: ' + e.message);
                                        }
                                    }}
                                    style={{ width: '100%', marginBottom: '8px' }}
                                >
                                    <Icons.Code size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Get Expansions
                                </SecondaryButton>
                                <SecondaryButton 
                                    onClick={() => {
                                        console.clear();
                                        setRestartMessage('Console cleared');
                                    }}
                                    style={{ width: '100%' }}
                                >
                                    <Icons.RotateCw size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Clear Console
                                </SecondaryButton>
                                {restartMessage && (
                                    <div style={{ fontSize: '10px', color: '#00ff00', marginTop: '8px', fontFamily: 'monospace' }}>
                                        {restartMessage}
                                    </div>
                                )}
                            </div>

                            <div style={{ backgroundColor: '#1a1f2e', padding: '16px', borderRadius: '4px', border: '1px solid #3e3e42' }}>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '12px' }}>File Manager</div>
                                <SecondaryButton 
                                    onClick={() => {
                                        setRestartMessage('Validating expansion files...');
                                        api.expansion.call('validateExpansions').then(validation => {
                                            console.log('[DevTools] Validation Results:', validation);
                                            const summary = `Valid: ${validation.valid}, Errors: ${validation.errors}`;
                                            setRestartMessage(summary);
                                        }).catch(err => setRestartMessage('Validation error'));
                                    }}
                                    style={{ width: '100%', marginBottom: '12px', padding: '12px' }}
                                >
                                    <Icons.CheckCircle size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Validate Files
                                </SecondaryButton>
                                <SecondaryButton 
                                    onClick={() => {
                                        setRestartMessage('Finding duplicate files...');
                                        api.expansion.call('findDuplicates').then(duplicates => {
                                            if (duplicates && duplicates.length > 0) {
                                                console.log('[DevTools] Duplicates Found:', duplicates);
                                                setRestartMessage(`Found ${duplicates.length} duplicate files`);
                                            } else {
                                                setRestartMessage('No duplicates found');
                                            }
                                        }).catch(err => setRestartMessage('Duplicate search failed'));
                                    }}
                                    style={{ width: '100%', marginBottom: '12px', padding: '12px' }}
                                >
                                    <Icons.Copy size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> Find Duplicates
                                </SecondaryButton>
                                <SecondaryButton 
                                    onClick={() => {
                                        setRestartMessage('Opening Electron console...');
                                        api.expansion.call('getElectronLogs').then(logs => {
                                            setElectronLogs(logs || []);
                                            setShowConsole(true);
                                        }).catch(err => setRestartMessage('Console error'));
                                    }}
                                    style={{ width: '100%', padding: '12px' }}
                                >
                                    <Icons.Terminal size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} /> View Console
                                </SecondaryButton>
                            </div>
                        </div>

                        {expansions.length > 0 && (
                            <div style={{ backgroundColor: '#1a1f2e', padding: '12px', borderRadius: '4px', border: '1px solid #3e3e42', marginBottom: '20px' }}>
                                <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>
                                    Installed Expansions ({expansions.length})
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                    {expansions.map((exp, idx) => (
                                        <div key={idx} style={{ 
                                            backgroundColor: '#0f1419',
                                            padding: '10px',
                                            borderRadius: '3px',
                                            border: '1px solid #2d2d30'
                                        }}>
                                            <div style={{ fontSize: '11px', color: '#00d4ff', fontWeight: 'bold', marginBottom: '4px' }}>
                                                {exp.name}
                                            </div>
                                            <div style={{ fontSize: '10px', color: '#888' }}>
                                                Pages: {exp.pages?.length || 0} {exp.hasMain && '| Main: ✓'}
                                            </div>
                                            {exp.pages && exp.pages.length > 0 && (
                                                <div style={{ fontSize: '10px', color: '#ccc', marginTop: '4px' }}>
                                                    {exp.pages.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                    </Section>
                )}

                {showConsole && (
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 1000
                    }}>
                        <div style={{
                            backgroundColor: '#0f1419',
                            border: '1px solid #3e3e42',
                            borderRadius: '4px',
                            width: '90%',
                            maxWidth: '800px',
                            height: '80vh',
                            display: 'flex',
                            flexDirection: 'column',
                            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)'
                        }}>
                            <div style={{
                                padding: '16px',
                                borderBottom: '1px solid #3e3e42',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <div style={{ color: '#00d4ff', fontWeight: 'bold', fontSize: '14px' }}>
                                    Electron Console
                                </div>
                                <SecondaryButton
                                    onClick={() => setShowConsole(false)}
                                    style={{ padding: '6px 12px', fontSize: '12px' }}
                                >
                                    Close
                                </SecondaryButton>
                            </div>
                            <div style={{
                                flex: 1,
                                overflow: 'auto',
                                padding: '12px',
                                fontFamily: 'monospace',
                                fontSize: '11px',
                                backgroundColor: '#1a1f2e'
                            }}>
                                {electronLogs.length === 0 ? (
                                    <div style={{ color: '#666' }}>No console logs available. Check main process logs.</div>
                                ) : (
                                    electronLogs.map((log, idx) => (
                                        <div key={idx} style={{
                                            marginBottom: '4px',
                                            color: log.level === 'error' ? '#ff6b6b' : log.level === 'warn' ? '#ffd93d' : '#aaa',
                                            wordBreak: 'break-word'
                                        }}>
                                            <span style={{ color: '#666' }}>[{log.timestamp}]</span> <span style={{ color: '#00d4ff' }}>[{log.level.toUpperCase()}]</span> {log.message}
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </ScrollContainer>
    );
};
