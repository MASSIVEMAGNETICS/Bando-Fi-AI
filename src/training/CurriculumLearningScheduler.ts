/**
 * Curriculum Learning Scheduler
 * 
 * Implements progressive training curriculum that gradually increases
 * task complexity for more efficient learning.
 */

export interface CurriculumStage {
    name: string;
    difficulty: number;
    duration: number;
    taskTypes: string[];
    datasetSize: number;
}

export interface TrainingProgress {
    currentStage: number;
    stagesCompleted: number;
    totalLoss: number;
    avgAccuracy: number;
    readyForNextStage: boolean;
}

export class CurriculumLearningScheduler {
    private stages: CurriculumStage[];
    private currentStageIndex: number;
    private progress: TrainingProgress;
    private performanceHistory: number[];
    
    constructor() {
        this.stages = this.initializeCurriculum();
        this.currentStageIndex = 0;
        this.progress = {
            currentStage: 0,
            stagesCompleted: 0,
            totalLoss: 0,
            avgAccuracy: 0,
            readyForNextStage: false
        };
        this.performanceHistory = [];
    }

    private initializeCurriculum(): CurriculumStage[] {
        return [
            {
                name: 'Foundation',
                difficulty: 0.2,
                duration: 1000,
                taskTypes: ['simple_shapes', 'basic_colors'],
                datasetSize: 1000
            },
            {
                name: 'Intermediate',
                difficulty: 0.5,
                duration: 2000,
                taskTypes: ['textures', 'simple_scenes', 'style_transfer'],
                datasetSize: 5000
            },
            {
                name: 'Advanced',
                difficulty: 0.7,
                duration: 3000,
                taskTypes: ['complex_scenes', 'multi_object', 'photorealism'],
                datasetSize: 10000
            },
            {
                name: 'Expert',
                difficulty: 0.9,
                duration: 5000,
                taskTypes: ['high_resolution', 'fine_details', 'artistic_styles'],
                datasetSize: 20000
            },
            {
                name: 'Master',
                difficulty: 1.0,
                duration: 10000,
                taskTypes: ['all_tasks', 'zero_shot', 'creative_synthesis'],
                datasetSize: 50000
            }
        ];
    }

    /**
     * Update training progress and determine stage advancement
     */
    public updateProgress(loss: number, accuracy: number): TrainingProgress {
        this.performanceHistory.push(accuracy);
        
        // Keep rolling window of recent performance
        if (this.performanceHistory.length > 100) {
            this.performanceHistory.shift();
        }

        this.progress.totalLoss = loss;
        this.progress.avgAccuracy = accuracy;

        // Check if ready for next stage
        const shouldAdvance = this.shouldAdvanceStage();
        this.progress.readyForNextStage = shouldAdvance;

        if (shouldAdvance && this.currentStageIndex < this.stages.length - 1) {
            this.advanceStage();
        }

        return this.progress;
    }

    private shouldAdvanceStage(): boolean {
        if (this.performanceHistory.length < 20) {
            return false; // Need more data
        }

        const recentPerformance = this.performanceHistory.slice(-20);
        const avgRecent = recentPerformance.reduce((a, b) => a + b, 0) / recentPerformance.length;
        
        const currentStage = this.stages[this.currentStageIndex];
        const requiredAccuracy = 0.7 + (currentStage.difficulty * 0.2);

        // Check if performance is stable and above threshold
        const isStable = this.isPerformanceStable(recentPerformance);
        const meetsThreshold = avgRecent >= requiredAccuracy;

        return isStable && meetsThreshold;
    }

    private isPerformanceStable(recentPerformance: number[]): boolean {
        // Calculate variance
        const mean = recentPerformance.reduce((a, b) => a + b, 0) / recentPerformance.length;
        const variance = recentPerformance.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / recentPerformance.length;
        const stdDev = Math.sqrt(variance);
        
        // Performance is stable if standard deviation is low
        return stdDev < 0.05;
    }

    private advanceStage(): void {
        this.progress.stagesCompleted++;
        this.currentStageIndex++;
        this.progress.currentStage = this.currentStageIndex;
        this.performanceHistory = []; // Reset history for new stage
        
        console.log(`Advanced to stage: ${this.getCurrentStage().name}`);
    }

    public getCurrentStage(): CurriculumStage {
        return this.stages[this.currentStageIndex];
    }

    public getProgress(): TrainingProgress {
        return this.progress;
    }

    /**
     * Get recommended learning rate based on stage
     */
    public getRecommendedLearningRate(): number {
        const stage = this.getCurrentStage();
        // Higher difficulty stages use lower learning rates
        return 0.001 * (1 - stage.difficulty * 0.5);
    }

    /**
     * Get recommended batch size based on stage
     */
    public getRecommendedBatchSize(): number {
        const stage = this.getCurrentStage();
        // Larger batches for easier stages
        return Math.floor(32 * (1 + (1 - stage.difficulty)));
    }

    /**
     * Sample tasks appropriate for current stage
     */
    public sampleTasksForCurrentStage(count: number): string[] {
        const stage = this.getCurrentStage();
        const tasks: string[] = [];
        
        for (let i = 0; i < count; i++) {
            const randomTask = stage.taskTypes[Math.floor(Math.random() * stage.taskTypes.length)];
            tasks.push(randomTask);
        }
        
        return tasks;
    }

    /**
     * Get full curriculum overview
     */
    public getCurriculumOverview(): {
        stages: CurriculumStage[];
        currentStage: CurriculumStage;
        progress: TrainingProgress;
        estimatedCompletion: number;
    } {
        const completedDuration = this.stages
            .slice(0, this.currentStageIndex)
            .reduce((sum, stage) => sum + stage.duration, 0);
        
        const totalDuration = this.stages.reduce((sum, stage) => sum + stage.duration, 0);
        const estimatedCompletion = (completedDuration / totalDuration) * 100;

        return {
            stages: this.stages,
            currentStage: this.getCurrentStage(),
            progress: this.progress,
            estimatedCompletion
        };
    }
}
