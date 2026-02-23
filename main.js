const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn, exec } = require('child_process');

// Cache Electron logs for the UI.
const electronLogs = [];
const maxLogs = 100;

module.exports.init = async function () {
    
    const nm = api.nexomaker;

    nm.regRoute(
        'devtools',
        __dirname + '/pages/DevTools.jsx'
    );

    nm.postSidebarIcon({
        key: 'devtools',
        button: 'DevTools',
        icon: 'Wrench',
        route: '/devtools',
        page: 'devtools'
    });

    api.console.log('[DevTools] Loaded - Press Ctrl+Shift+R to restart');
    
    const originalConsoleLog = api.console.log;
    api.console.log = function(...args) {
        const message = args.map(arg => {
            if (typeof arg === 'string') return arg;
            try { return String(arg); } catch(e) { return '[Object]'; }
        }).join(' ');
        electronLogs.push({
            level: 'log',
            message: message,
            timestamp: new Date().toLocaleTimeString()
        });
        if (electronLogs.length > maxLogs) {
            electronLogs.shift();
        }
        return originalConsoleLog.apply(api.console, args);
    };
};

module.exports.metadata = {
    id: 'devtools',
    version: '1.0.0',
    name: 'DevTools',
    description: 'Developer tools for NexoMaker - reload, console, and utilities',
    author: 'Developer',
    apiKey: 'nmk_V96mVoP3M4w3pUri5rqr9nWcW1JPRZrOs-JekGFPOo4'
};


module.exports.getExpansionInfo = function() {
    try {
        const expansionsDir = path.join(__dirname, '..');
        const expansions = fs.readdirSync(expansionsDir)
            .filter(f => fs.statSync(path.join(expansionsDir, f)).isDirectory())
            .map(dir => {
                const mainPath = path.join(expansionsDir, dir, 'main.js');
                const pagesPath = path.join(expansionsDir, dir, 'pages');
                const hasMain = fs.existsSync(mainPath);
                const pages = hasMain && fs.existsSync(pagesPath) 
                    ? fs.readdirSync(pagesPath).filter(f => f.endsWith('.jsx') || f.endsWith('.js'))
                    : [];
                
                return {
                    name: dir,
                    hasMain,
                    pages,
                    path: path.join(expansionsDir, dir)
                };
            });
        
        return {
            success: true,
            expansions,
            count: expansions.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports.reloadExpansion = function(expansionId) {
    api.console.log(`[DevTools] Reloading expansion: ${expansionId}`);
    return {
        success: true,
        message: `Expansion '${expansionId}' reload triggered (requires NexoMaker API support)`
    };
};

module.exports.watchDirectory = function(dirPath) {
    const fs = require('fs');
    try {
        const stats = fs.statSync(dirPath);
        if (!stats.isDirectory()) {
            return {
                success: false,
                error: 'Path is not a directory'
            };
        }
        
        // Walk a directory tree and collect file info.
        const getFilesRecursive = (dir) => {
            let files = [];
            const items = fs.readdirSync(dir);
            for (const item of items) {
                const fullPath = path.join(dir, item);
                const stat = fs.statSync(fullPath);
                if (stat.isDirectory()) {
                    files = files.concat(getFilesRecursive(fullPath));
                } else {
                    files.push({
                        path: fullPath,
                        size: stat.size,
                        modified: stat.mtime.toISOString(),
                        name: item
                    });
                }
            }
            return files;
        };
        
        const files = getFilesRecursive(dirPath);
        return {
            success: true,
            files,
            totalSize: files.reduce((sum, f) => sum + f.size, 0)
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports.browseExpansions = function() {
    try {
        const expansionsDir = path.join(__dirname, '..');
        return {
            success: true,
            path: expansionsDir,
            items: fs.readdirSync(expansionsDir).map(item => {
                const fullPath = path.join(expansionsDir, item);
                const stat = fs.statSync(fullPath);
                return {
                    name: item,
                    isDirectory: stat.isDirectory(),
                    size: stat.size,
                    modified: stat.mtime.toISOString()
                };
            })
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
};

module.exports.listProjectFolders = function() {
    try {
        const fs = require('fs');
        
        const expansionsParent = path.dirname(path.dirname(__dirname));
        const projectsDir = path.join(expansionsParent, 'Projects');
        
        if (!fs.existsSync(projectsDir)) {
            return {
                success: true,
                projects: [],
                projectsPath: projectsDir
            };
        }
        
        const items = fs.readdirSync(projectsDir);
        const projects = items.filter(item => {
            try {
                return fs.statSync(path.join(projectsDir, item)).isDirectory();
            } catch {
                return false;
            }
        }).sort();
        
        return {
            success: true,
            projects: projects,
            projectsPath: projectsDir
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            projects: []
        };
    }
};

module.exports.getServerInfoForProject = function(projectFolder) {
    try {
        const fs = require('fs');
        
        const expansionsParent = path.dirname(path.dirname(__dirname));
        const projectPath = path.join(expansionsParent, 'Projects', projectFolder);
        
        let serverInfo = {
            success: true,
            server: {
                found: false,
                version: 'Not detected',
                type: 'Unknown',
                pluginsDir: '',
                pluginCount: 0,
                plugins: [],
                properties: {}
            },
            debug: {
                projectPath: projectPath,
                projectPathExists: false,
                environmentPathExists: false,
                filesInProjectPath: [],
                filesInEnvironmentPath: [],
                checkedPaths: [],
                environmentSubfolders: [],
                searchingIn: '',
                jarSearchPath: '',
                detectedFromDir: '',
                detectionMethod: ''
            }
        };
        
        if (!fs.existsSync(projectPath)) {
            serverInfo.debug.projectPathExists = false;
            return serverInfo;
        }
        serverInfo.debug.projectPathExists = true;
        
        try {
            serverInfo.debug.filesInProjectPath = fs.readdirSync(projectPath);
        } catch (e) {
            serverInfo.debug.filesInProjectPath = ['[could not read: ' + e.message + ']'];
        }
        
        const environmentPath = path.join(projectPath, 'Environment');
        serverInfo.debug.environmentPathExists = fs.existsSync(environmentPath);
        
        let serverSearchPath = projectPath;
        let jarSearchPath = projectPath;
        let serverDir = '';
        
        if (fs.existsSync(environmentPath)) {
            try {
                serverInfo.debug.filesInEnvironmentPath = fs.readdirSync(environmentPath);
                const envItems = fs.readdirSync(environmentPath);
                for (const item of envItems) {
                    const itemPath = path.join(environmentPath, item);
                    try {
                        if (fs.statSync(itemPath).isDirectory()) {
                            serverInfo.debug.environmentSubfolders.push(item);
                            const pluginsTest = path.join(itemPath, 'plugins');
                            if (fs.existsSync(pluginsTest)) {
                                serverSearchPath = itemPath;
                                serverDir = itemPath;
                                
                                const typeVersionMatch = item.match(/^([a-z]+)-(\d+\.\d+(?:\.\d+)?)/i);
                                if (typeVersionMatch) {
                                    const detectedType = typeVersionMatch[1].charAt(0).toUpperCase() + typeVersionMatch[1].slice(1).toLowerCase();
                                    const detectedVersion = typeVersionMatch[2];
                                    
                                    serverInfo.server.type = detectedType;
                                    serverInfo.server.version = detectedVersion;
                                    serverInfo.debug.detectedFromDir = item;
                                    serverInfo.debug.detectionMethod = 'directory name parsing';
                                }
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {
                serverInfo.debug.filesInEnvironmentPath = ['[could not read: ' + e.message + ']'];
            }
            
            jarSearchPath = projectPath;
            serverInfo.debug.searchingIn = 'Environment subfolders';
            serverInfo.debug.jarSearchPath = jarSearchPath;
        } else {
            serverInfo.debug.searchingIn = 'Project root';
            serverInfo.debug.jarSearchPath = projectPath;
        }
        
        // Common server locations within the search path.
        const possibleServerPaths = [
            path.join(serverSearchPath, 'plugins'),
            path.join(serverSearchPath, 'server', 'plugins'),
            path.join(serverSearchPath, 'paper', 'plugins'),
            path.join(serverSearchPath, 'minecraft', 'plugins'),
            path.join(serverSearchPath, 'servers', 'paper', 'plugins'),
            path.join(serverSearchPath, 'spigot', 'plugins'),
            path.join(serverSearchPath, 'purpur', 'plugins'),
            path.join(serverSearchPath, 'folia', 'plugins')
        ];
        
        let pluginsDir = '';
        
        // Find the plugins directory and track checks.
        for (const testPath of possibleServerPaths) {
            const exists = fs.existsSync(testPath);
            serverInfo.debug.checkedPaths.push({
                path: testPath,
                exists: exists
            });
            if (exists) {
                pluginsDir = testPath;
                break;
            }
        }
        
        if (!pluginsDir) {
            return serverInfo;
        }
        
        serverInfo.server.found = true;
        serverInfo.server.pluginsDir = pluginsDir;
        
        if (serverDir) {
            const propsPath = path.join(serverDir, 'server.properties');
            if (fs.existsSync(propsPath)) {
                try {
                    const propsContent = fs.readFileSync(propsPath, 'utf8');
                    const lines = propsContent.split('\n');
                    
                    for (const line of lines) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith('#')) continue;
                        
                        const [key, ...valueParts] = trimmed.split('=');
                        if (key && valueParts.length > 0) {
                            const value = valueParts.join('=').trim();
                            serverInfo.server.properties[key.trim()] = value;
                        }
                    }
                } catch (e) {
                    serverInfo.debug.propertiesReadError = e.message;
                }
            }
        }
        
        try {
            const pluginFiles = fs.readdirSync(pluginsDir)
                .filter(f => f.endsWith('.jar'))
                .map(f => f.replace(/\.jar$/, ''));
            
            serverInfo.server.pluginCount = pluginFiles.length;
            serverInfo.server.plugins = pluginFiles.slice(0, 20);
        } catch (e) {}
        
        return serverInfo;
    } catch (error) {
        return {
            success: false,
            error: error.message,
            server: {
                found: false,
                version: 'Error',
                type: 'Unknown'
            },
            debug: {
                error: error.toString()
            }
        };
    }
};

module.exports.getSystemInfo = function() {
    return module.exports.getServerInfoForProject('');
};

module.exports.listSubdirectories = function() {
    try {
        const expansionsDir = path.join(__dirname, '..');
        const directories = fs.readdirSync(expansionsDir)
            .filter(item => {
                const fullPath = path.join(expansionsDir, item);
                try {
                    return fs.statSync(fullPath).isDirectory();
                } catch {
                    return false;
                }
            })
            .sort();
        
        return {
            success: true,
            directories: directories.length > 0 ? directories : ['(all)']
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            directories: ['(all)']
        };
    }
};

module.exports.scanFileSizes = function(targetDir) {
    try {
        let scanPath = path.join(__dirname, '..');
        
        if (targetDir && targetDir !== '' && targetDir !== '(all)') {
            scanPath = path.join(__dirname, '..', targetDir);
        }
        
        if (!fs.existsSync(scanPath)) {
            return {
                success: false,
                error: 'Directory does not exist',
                totalSize: 0,
                directoryCount: 0,
                fileCount: 0,
                fileTypes: {}
            };
        }
        
        let totalSize = 0;
        let directoryCount = 0;
        let fileCount = 0;
        const fileTypes = {};
        
        // Walk a directory tree and accumulate totals.
        const walkDir = (dir) => {
            try {
                const files = fs.readdirSync(dir);
                
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    try {
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            directoryCount++;
                            walkDir(fullPath);
                        } else {
                            fileCount++;
                            totalSize += stat.size;
                            const ext = path.extname(file).toLowerCase() || 'no-extension';
                            fileTypes[ext] = (fileTypes[ext] || 0) + 1;
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        };
        
        walkDir(scanPath);
        
        return {
            success: true,
            totalSize,
            directoryCount,
            fileCount,
            fileTypes
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            totalSize: 0,
            directoryCount: 0,
            fileCount: 0,
            fileTypes: {}
        };
    }
};

module.exports.validateExpansions = function() {
    try {
        const result = {
            valid: 0,
            errors: 0,
            issues: []
        };
        
        const expansionsDir = path.join(__dirname, '..');
        const expansions = fs.readdirSync(expansionsDir)
            .filter(f => fs.statSync(path.join(expansionsDir, f)).isDirectory());
        
        for (const exp of expansions) {
            const expPath = path.join(expansionsDir, exp);
            const mainPath = path.join(expPath, 'main.js');
            const packagePath = path.join(expPath, 'package.json');
            
            if (!fs.existsSync(mainPath)) {
                result.errors++;
                result.issues.push(`${exp}: Missing main.js`);
            } else {
                result.valid++;
            }
        }
        
        return result;
    } catch (error) {
        return {
            valid: 0,
            errors: 1,
            issues: [error.message]
        };
    }
};

module.exports.findDuplicates = function() {
    try {
        const fileMap = new Map();
        const duplicates = [];
        
        const scanDirectory = (dir) => {
            try {
                const items = fs.readdirSync(dir);
                
                for (const item of items) {
                    const fullPath = path.join(dir, item);
                    try {
                        const stat = fs.statSync(fullPath);
                        
                        if (stat.isDirectory()) {
                            scanDirectory(fullPath);
                        } else {
                            const fileName = item.toLowerCase();
                            if (!fileMap.has(fileName)) {
                                fileMap.set(fileName, []);
                            }
                            fileMap.get(fileName).push(fullPath);
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        };
        
        const expansionsDir = path.join(__dirname, '..');
        scanDirectory(expansionsDir);
        
        for (const [name, paths] of fileMap) {
            if (paths.length > 1) {
                duplicates.push({
                    name: name,
                    count: paths.length,
                    locations: paths.map(p => p.replace(/\\/g, '/'))
                });
            }
        }
        
        return {
            success: true,
            duplicates: duplicates,
            count: duplicates.length
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            duplicates: [],
            count: 0
        };
    }
};

module.exports.getElectronLogs = function() {
    return electronLogs;
};
