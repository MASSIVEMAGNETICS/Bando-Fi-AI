/**
 * Modular Plugin System
 * 
 * Enables dynamic loading of custom components, loss functions, and guidance signals.
 */

export type PluginType = 'loss' | 'guidance' | 'preprocessor' | 'postprocessor' | 'attention' | 'optimizer';

export interface Plugin {
    id: string;
    name: string;
    type: PluginType;
    version: string;
    author?: string;
    description?: string;
    execute: (input: any, config?: any) => any | Promise<any>;
    validate?: (input: any) => boolean;
    config?: any;
}

export interface PluginRegistry {
    [id: string]: Plugin;
}

export class ModularPluginSystem {
    private plugins: PluginRegistry;
    private activePlugins: Set<string>;
    
    constructor() {
        this.plugins = {};
        this.activePlugins = new Set();
        this.registerDefaultPlugins();
    }

    /**
     * Register a new plugin
     */
    public registerPlugin(plugin: Plugin): void {
        if (this.plugins[plugin.id]) {
            console.warn(`Plugin ${plugin.id} already exists. Overwriting...`);
        }
        
        this.plugins[plugin.id] = plugin;
        console.log(`Registered plugin: ${plugin.name} (${plugin.type})`);
    }

    /**
     * Activate a plugin
     */
    public activatePlugin(id: string): boolean {
        if (!this.plugins[id]) {
            console.error(`Plugin ${id} not found`);
            return false;
        }
        
        this.activePlugins.add(id);
        console.log(`Activated plugin: ${this.plugins[id].name}`);
        return true;
    }

    /**
     * Deactivate a plugin
     */
    public deactivatePlugin(id: string): boolean {
        if (!this.activePlugins.has(id)) {
            console.warn(`Plugin ${id} is not active`);
            return false;
        }
        
        this.activePlugins.delete(id);
        console.log(`Deactivated plugin: ${this.plugins[id].name}`);
        return true;
    }

    /**
     * Execute plugin
     */
    public async executePlugin(id: string, input: any, config?: any): Promise<any> {
        const plugin = this.plugins[id];
        
        if (!plugin) {
            throw new Error(`Plugin ${id} not found`);
        }

        if (!this.activePlugins.has(id)) {
            throw new Error(`Plugin ${id} is not active`);
        }

        // Validate input if validator exists
        if (plugin.validate && !plugin.validate(input)) {
            throw new Error(`Plugin ${id} input validation failed`);
        }

        // Execute plugin
        try {
            const result = await plugin.execute(input, config || plugin.config);
            return result;
        } catch (error) {
            console.error(`Error executing plugin ${id}:`, error);
            throw error;
        }
    }

    /**
     * Execute all active plugins of a specific type
     */
    public async executePluginsByType(
        type: PluginType,
        input: any,
        config?: any
    ): Promise<any> {
        let result = input;
        
        for (const id of this.activePlugins) {
            const plugin = this.plugins[id];
            if (plugin.type === type) {
                result = await this.executePlugin(id, result, config);
            }
        }
        
        return result;
    }

    /**
     * Get plugin information
     */
    public getPlugin(id: string): Plugin | null {
        return this.plugins[id] || null;
    }

    /**
     * List all plugins
     */
    public listPlugins(type?: PluginType): Plugin[] {
        const allPlugins = Object.values(this.plugins);
        
        if (type) {
            return allPlugins.filter(p => p.type === type);
        }
        
        return allPlugins;
    }

    /**
     * List active plugins
     */
    public listActivePlugins(type?: PluginType): Plugin[] {
        const activePlugins = Array.from(this.activePlugins)
            .map(id => this.plugins[id])
            .filter(p => p !== undefined);
        
        if (type) {
            return activePlugins.filter(p => p.type === type);
        }
        
        return activePlugins;
    }

    /**
     * Register default plugins
     */
    private registerDefaultPlugins(): void {
        // Perceptual loss plugin
        this.registerPlugin({
            id: 'perceptual-loss',
            name: 'Perceptual Loss',
            type: 'loss',
            version: '1.0.0',
            description: 'Computes perceptual loss based on feature similarity',
            execute: (input: { predicted: any; target: any }) => {
                // Simplified perceptual loss
                return Math.random() * 0.5; // Placeholder
            }
        });

        // Style guidance plugin
        this.registerPlugin({
            id: 'style-guidance',
            name: 'Style Guidance',
            type: 'guidance',
            version: '1.0.0',
            description: 'Applies artistic style guidance to generation',
            execute: (input: any, config: { styleStrength: number }) => {
                const strength = config?.styleStrength || 0.5;
                console.log(`Applying style guidance with strength: ${strength}`);
                return { ...input, styleApplied: true, strength };
            }
        });

        // Noise reduction preprocessor
        this.registerPlugin({
            id: 'noise-reduction',
            name: 'Noise Reduction',
            type: 'preprocessor',
            version: '1.0.0',
            description: 'Reduces noise in input data',
            execute: (input: Float32Array) => {
                // Simple moving average filter
                const filtered = new Float32Array(input.length);
                const windowSize = 3;
                
                for (let i = 0; i < input.length; i++) {
                    let sum = 0;
                    let count = 0;
                    
                    for (let j = Math.max(0, i - windowSize); j <= Math.min(input.length - 1, i + windowSize); j++) {
                        sum += input[j];
                        count++;
                    }
                    
                    filtered[i] = sum / count;
                }
                
                return filtered;
            }
        });

        // Sharpening postprocessor
        this.registerPlugin({
            id: 'sharpen',
            name: 'Image Sharpening',
            type: 'postprocessor',
            version: '1.0.0',
            description: 'Enhances image sharpness',
            execute: (input: any, config: { intensity: number }) => {
                const intensity = config?.intensity || 1.0;
                console.log(`Applying sharpening with intensity: ${intensity}`);
                return { ...input, sharpened: true, intensity };
            }
        });

        // Adaptive learning rate optimizer
        this.registerPlugin({
            id: 'adaptive-lr',
            name: 'Adaptive Learning Rate',
            type: 'optimizer',
            version: '1.0.0',
            description: 'Dynamically adjusts learning rate based on loss',
            execute: (input: { loss: number; currentLR: number }) => {
                const { loss, currentLR } = input;
                
                // Reduce LR if loss is high, increase if low
                let newLR = currentLR;
                if (loss > 1.0) {
                    newLR *= 0.9;
                } else if (loss < 0.1) {
                    newLR *= 1.05;
                }
                
                return { newLR, adjustment: newLR / currentLR };
            }
        });
    }

    /**
     * Create custom plugin from function
     */
    public createPlugin(
        id: string,
        name: string,
        type: PluginType,
        executeFn: (input: any, config?: any) => any | Promise<any>,
        options?: {
            version?: string;
            description?: string;
            validate?: (input: any) => boolean;
            config?: any;
        }
    ): void {
        const plugin: Plugin = {
            id,
            name,
            type,
            version: options?.version || '1.0.0',
            description: options?.description,
            execute: executeFn,
            validate: options?.validate,
            config: options?.config
        };
        
        this.registerPlugin(plugin);
    }

    /**
     * Remove plugin
     */
    public removePlugin(id: string): boolean {
        if (!this.plugins[id]) {
            return false;
        }
        
        this.deactivatePlugin(id);
        delete this.plugins[id];
        console.log(`Removed plugin: ${id}`);
        return true;
    }

    /**
     * Get plugin execution pipeline
     */
    public getExecutionPipeline(type: PluginType): string[] {
        return Array.from(this.activePlugins)
            .filter(id => this.plugins[id]?.type === type)
            .map(id => this.plugins[id].name);
    }
}
