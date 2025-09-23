import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { GoogleGenAI, GenerateContentResponse, Modality, Type } from "@google/genai";

interface SessionGalleryItem {
    src: string;
    mediaType: 'image' | 'video' | 'audio';
    blendMode: string | null;
    date: Date;
    name: string;
    tags: string[];
    type: 'blend' | 'swap' | 'inpaint' | 'video' | 'style' | 'audio' | 'genesis';
    aspectRatio: string;
}

interface ImageTransform {
    scale: number;
    x: number;
    y: number;
}

interface VideoQueueItem {
    id: string;
    videoPrompt: string;
    videoImages: (string | null)[];
    videoFaceRefImage: string | null;
    videoStyleImage: string | null;
    videoBlendMode: string;
    videoDialogue: string;
}

// #region Control Components (Moved outside App to fix input focus bug)

const ImageUploader = ({ image, onUpload, onRemove, label, styles }: { image: string | null, onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void, onRemove: () => void, label: string, styles: any }) => {
    const [isHovered, setIsHovered] = useState(false);
    const uploaderStyle = {...styles.uploadBox, ...(isHovered && !image ? styles.uploadBoxHover : {})};
    return (
        <div style={{ position: 'relative' }}>
            <label style={uploaderStyle} onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
                <input type="file" accept="image/png, image/jpeg" onChange={onUpload} style={{ display: 'none' }} aria-label={label} />
                {image ? (
                     <img src={image} alt="Preview" style={styles.imagePreview} />
                ) : ( <> <span style={styles.uploadIcon}>🖼️</span> <span style={styles.uploadText}>{label}</span> </> )}
            </label>
            {image && <button type="button" style={styles.removeButton} onClick={(e) => {e.preventDefault(); onRemove();}} aria-label={`Remove ${label}`}>X</button>}
        </div>
    );
};

const ZoomPanImageUploader = ({ image, onUpload, onRemove, label, transform, onTransformChange, styles }) => {
    const [isPanning, setIsPanning] = useState(false);
    const [startPos, setStartPos] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLLabelElement>(null);

    const handleMouseDown = (e: React.MouseEvent<HTMLLabelElement>) => {
        if (!image.src) return;
        e.preventDefault();
        setIsPanning(true);
        setStartPos({ x: e.clientX - transform.x, y: e.clientY - transform.y });
        e.currentTarget.style.cursor = 'grabbing';
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLLabelElement>) => {
        if (!isPanning || !image.src) return;
        e.preventDefault();
        onTransformChange({ ...transform, x: e.clientX - startPos.x, y: e.clientY - startPos.y });
    };

    const handleMouseUpOrLeave = (e: React.MouseEvent<HTMLLabelElement>) => {
        if (!isPanning) return;
        setIsPanning(false);
        e.currentTarget.style.cursor = 'grab';
    };

    const handleWheel = (e: React.WheelEvent<HTMLLabelElement>) => {
        if (!image.src || !containerRef.current) return;
        e.preventDefault();
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const scaleAmount = -e.deltaY * 0.001;
        const newScale = Math.max(0.5, Math.min(5, transform.scale + scaleAmount));
        
        const newX = mouseX - (mouseX - transform.x) * (newScale / transform.scale);
        const newY = mouseY - (mouseY - transform.y) * (newScale / transform.scale);
        
        onTransformChange({ scale: newScale, x: newX, y: newY });
    };

    return (
        <div style={{ position: 'relative' }}>
            <label 
                ref={containerRef}
                style={{
                    ...styles.uploadBox, 
                    cursor: image.src ? (isPanning ? 'grabbing' : 'grab') : 'pointer'
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUpOrLeave}
                onMouseLeave={handleMouseUpOrLeave}
                onWheel={handleWheel}
            >
                <input type="file" accept="image/png, image/jpeg" onChange={onUpload} style={{ display: 'none' }} aria-label={label} />
                {image.src ? (
                     <img src={image.src} alt="Preview" style={{...styles.imagePreview, transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, transition: isPanning ? 'none' : 'transform 0.1s ease-out' }} />
                ) : ( <> <span style={styles.uploadIcon}>🖼️</span> <span style={styles.uploadText}>{label}</span> </> )}
            </label>
            {image.src && <button type="button" style={styles.removeButton} onClick={(e) => {e.preventDefault(); onRemove();}} aria-label={`Remove ${label}`}>X</button>}
        </div>
    );
};

const MaskingCanvas = ({ sourceImage, brushSize, setBrushSize, brushShape, setBrushShape, onMaskChange, onClear, styles }: { sourceImage: string, brushSize: number, setBrushSize: (size: number) => void, brushShape: 'round' | 'square', setBrushShape: (shape: 'round' | 'square') => void, onMaskChange: (mask: string | null) => void, onClear: () => void, styles: any }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawing = useRef(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0, visible: false });
    
    // Undo/Redo state
    const history = useRef<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    const drawImageOnCanvas = (dataUrl: string) => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        
        const maskImage = new Image();
        maskImage.src = dataUrl;
        maskImage.onload = () => {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(maskImage, 0, 0);
        };
    };
    
    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const image = new Image();
        image.src = sourceImage;
        image.onload = () => {
            canvas.width = image.naturalWidth;
            canvas.height = image.naturalHeight;
            // Reset history when source image changes
            history.current = [];
            setHistoryIndex(-1);
            onMaskChange(null);
        };
    }, [sourceImage]);

    const getCoords = (e: React.MouseEvent | React.TouchEvent) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;
        if ('touches' in e) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        return {
            x: (clientX - rect.left) * (canvas.width / rect.width),
            y: (clientY - rect.top) * (canvas.height / rect.height)
        };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        isDrawing.current = true;
        const { x, y } = getCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        ctx.lineCap = brushShape === 'round' ? 'round' : 'square';
        ctx.lineJoin = brushShape === 'round' ? 'round' : 'miter';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.lineWidth = brushSize;
        const { x, y } = getCoords(e);
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const canvas = canvasRef.current;
        if (!canvas || !isDrawing.current) return;
        isDrawing.current = false;
        canvas.getContext('2d')?.closePath();
        
        const newMask = canvas.toDataURL();
        const newHistory = history.current.slice(0, historyIndex + 1);
        newHistory.push(newMask);
        history.current = newHistory;
        setHistoryIndex(newHistory.length - 1);
        
        onMaskChange(newMask);
    };

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            onClear();
            history.current = [];
            setHistoryIndex(-1);
        }
    };
    
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            setHistoryIndex(newIndex);
            drawImageOnCanvas(history.current[newIndex]);
            onMaskChange(history.current[newIndex]);
        } else if (historyIndex === 0) {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext('2d');
            if (canvas && ctx) {
                 ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
            setHistoryIndex(-1);
            onMaskChange(null);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.current.length - 1) {
            const newIndex = historyIndex + 1;
            setHistoryIndex(newIndex);
            drawImageOnCanvas(history.current[newIndex]);
            onMaskChange(history.current[newIndex]);
        }
    };

    const handleCursorMove = (e: React.MouseEvent) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top, visible: true });
    };
    const handleCursorLeave = () => setCursorPos(p => ({...p, visible: false}));

    const cursorStyle: React.CSSProperties = {
        position: 'absolute',
        left: `${cursorPos.x}px`,
        top: `${cursorPos.y}px`,
        width: `${brushSize}px`,
        height: `${brushSize}px`,
        borderRadius: brushShape === 'round' ? '50%' : '0',
        border: '1px solid var(--primary-color)',
        transform: 'translate(-50%, -50%)',
        pointerEvents: 'none',
        zIndex: 100,
        opacity: cursorPos.visible ? 1 : 0,
        transition: 'opacity 0.1s ease',
    };

    return (
        <div style={styles.maskingContainer} onMouseMove={handleCursorMove} onMouseLeave={handleCursorLeave}>
            {cursorPos.visible && <div style={cursorStyle}></div>}
            <img src={sourceImage} alt="Source for masking" style={{ width: '100%', borderRadius: '0px', pointerEvents: 'none', border: '1px solid var(--border-color)' }} />
            <canvas 
                ref={canvasRef} 
                style={{...styles.maskingCanvas, width: '100%', height: '100%'}}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
            />
            <div style={styles.maskControls}>
                 <div style={styles.sliderContainer}>
                    <span>Brush Size:</span>
                    <input type="range" min="10" max="100" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} style={styles.slider} aria-label="Brush size" />
                    <span>{brushSize}</span>
                </div>
                 <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button onClick={() => setBrushShape('round')} style={{...styles.actionButton, ...styles.secondaryActionButton, ...(brushShape === 'round' ? styles.aspectRatioButtonSelected : {}), flex: 1}}>Round</button>
                    <button onClick={() => setBrushShape('square')} style={{...styles.actionButton, ...styles.secondaryActionButton, ...(brushShape === 'square' ? styles.aspectRatioButtonSelected : {}), flex: 1}}>Square</button>
                </div>
                 <div style={{display: 'flex', gap: '0.5rem'}}>
                    <button onClick={handleUndo} disabled={historyIndex < 0} style={{...styles.actionButton, ...styles.secondaryActionButton, flex: 1}}>Undo</button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.current.length - 1} style={{...styles.actionButton, ...styles.secondaryActionButton, flex: 1}}>Redo</button>
                 </div>
                <button onClick={clearCanvas} style={{...styles.actionButton, ...styles.secondaryActionButton}}>Clear Mask</button>
            </div>
        </div>
    );
};

const BlendControls = ({ styles, blendImages, handleBlendImageUpload, handleRemoveBlendImage, handleBlendImageTransformChange, handleAddBlendImageSlot, blendFaceRefImage, setBlendFaceRefImage, blendMode, setBlendMode, BLEND_MODES, technicalBlendMode, setTechnicalBlendMode, TECHNICAL_BLEND_MODES, prompt, setPrompt, handleEnhancePrompt, isEnhancing, selectedModel, setSelectedModel, GENERATION_MODELS, aspectRatio, setAspectRatio, ASPECT_RATIOS, numberOfImages, setNumberOfImages, handleBlendImageInstructionChange }) => (
    <>
        <h2 style={styles.sectionTitle}>1. Upload Images & Add Instructions (2-5)</h2>
        <div style={styles.imageUploads}>
            {blendImages.map((image, index) => (
                <div key={index} style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                    <ZoomPanImageUploader
                        styles={styles}
                        image={image}
                        onUpload={(e) => handleBlendImageUpload(e, index)}
                        onRemove={() => handleRemoveBlendImage(index)}
                        label={`Image ${index + 1}`}
                        transform={image.transform}
                        onTransformChange={(newTransform) => handleBlendImageTransformChange(index, newTransform)}
                    />
                    {image.src && (
                        <textarea
                            style={{...styles.promptInput, minHeight: '40px', fontSize: '0.8rem', padding: '0.5rem', resize: 'none'}}
                            placeholder="e.g., Use as background..."
                            value={image.instruction}
                            onChange={(e) => handleBlendImageInstructionChange(index, e.target.value)}
                            aria-label={`Instruction for image ${index + 1}`}
                            rows={2}
                        />
                    )}
                </div>
            ))}
            {blendImages.length < 5 && ( <button onClick={handleAddBlendImageSlot} style={styles.addImageButton} className="addImageButton" aria-label="Add another image slot">+</button> )}
        </div>

        <h2 style={styles.sectionTitle}>2. Upload Face Reference (Optional)</h2>
         <div style={{maxWidth: '120px'}}>
            <ImageUploader styles={styles} image={blendFaceRefImage} onUpload={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setBlendFaceRefImage(reader.result as string);
                    reader.readAsDataURL(file);
                }
            }} onRemove={() => setBlendFaceRefImage(null)} label="Face Ref" />
        </div>
        <h2 style={styles.sectionTitle}>3. Choose Blend Style</h2>
        <div style={styles.blendModes}>
            {BLEND_MODES.map(mode => (
                <div key={mode.name} onClick={() => setBlendMode(mode.name)} style={{...styles.blendCard, ...(blendMode === mode.name ? styles.blendCardSelected : {})}} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setBlendMode(mode.name)} aria-pressed={blendMode === mode.name} className="blend-card">
                    <h4 style={styles.blendCardTitle}>{mode.name}</h4>
                    <p style={styles.blendCardDescription}>{mode.description}</p>
                </div>
            ))}
        </div>
         <h2 style={styles.sectionTitle}>4. Select Technical Blend Mode</h2>
         <select style={styles.selectInput} value={technicalBlendMode} onChange={e => setTechnicalBlendMode(e.target.value)} aria-label="Select technical blend mode">
            {TECHNICAL_BLEND_MODES.map(mode => ( <option key={mode} value={mode}>{mode}</option> ))}
        </select>
        <h2 style={styles.sectionTitle}>5. Add Guidance (Optional)</h2>
        <div style={styles.promptContainer}>
            <textarea style={{...styles.promptInput, paddingRight: '50px'}} placeholder="e.g., in the style of an oil painting, a surreal masterpiece..." value={prompt} onChange={(e) => setPrompt(e.target.value)} aria-label="Additional guidance prompt" />
            <button onClick={() => handleEnhancePrompt(prompt, setPrompt, 'image blending')} disabled={isEnhancing || !prompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
        <h2 style={styles.sectionTitle}>6. Select Generation Model</h2>
        <select style={styles.selectInput} value={selectedModel} onChange={e => setSelectedModel(e.target.value)} aria-label="Select generation model">
            {GENERATION_MODELS.map(model => ( <option key={model.id} value={model.id}>{model.name}</option> ))}
        </select>
        <h2 style={styles.sectionTitle}>7. Select Aspect Ratio</h2>
        <div style={styles.aspectRatioSelector}>
            {ASPECT_RATIOS.map(ratio => ( <button key={ratio} onClick={() => setAspectRatio(ratio)} style={{...styles.aspectRatioButton, ...(aspectRatio === ratio ? styles.aspectRatioButtonSelected : {})}} className="aspect-ratio-button"> {ratio} </button> ))}
        </div>
        <h2 style={styles.sectionTitle}>8. Number of Images</h2>
         <div style={styles.sliderContainer}>
            <input type="range" min="1" max="4" value={numberOfImages} onChange={e => setNumberOfImages(Number(e.target.value))} style={styles.slider} aria-label="Number of images to generate" />
            <span>{numberOfImages}</span>
        </div>
    </>
);

const FaceSwapControls = ({ styles, faceRefImage, setFaceRefImage, handleFaceRefUpload, sourceImage, setSourceImage, handleSourceImageUpload, brushSize, setBrushSize, brushShape, setBrushShape, setMask, faceFidelity, setFaceFidelity, colorMatching, setColorMatching, faceSwapPrompt, setFaceSwapPrompt, handleEnhancePrompt, isEnhancing }) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <h2 style={styles.sectionTitle}>1. Upload Images</h2>
         <p style={{marginTop: '-1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-color)'}}>
            Upload a source image and the face you want to swap onto it.
        </p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <ImageUploader styles={styles} image={faceRefImage} onUpload={handleFaceRefUpload} onRemove={() => setFaceRefImage(null)} label="Face to Swap" />
            <ImageUploader styles={styles} image={sourceImage} onUpload={handleSourceImageUpload} onRemove={() => setSourceImage(null)} label="Source Image" />
        </div>
        {sourceImage && (
            <div>
                 <h3 style={{...styles.sectionTitle, border: 'none', fontSize: '1rem'}}>2. Mask Area (Optional)</h3>
                 <p style={{marginTop: '-1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-color)'}}>Draw a mask on the source image to focus the swap on a specific area.</p>
                 <MaskingCanvas styles={styles} sourceImage={sourceImage} brushSize={brushSize} setBrushSize={setBrushSize} brushShape={brushShape} setBrushShape={setBrushShape} onMaskChange={setMask} onClear={() => setMask(null)} />
            </div>
        )}
        <h2 style={styles.sectionTitle}>3. Advanced Controls</h2>
         <div style={styles.sliderContainer}>
            <label htmlFor="faceFidelity" style={{flexBasis: '120px'}}>Face Fidelity:</label>
            <input id="faceFidelity" type="range" min="0" max="100" value={faceFidelity} onChange={e => setFaceFidelity(Number(e.target.value))} style={styles.slider} aria-label="Face fidelity percentage" />
            <span>{faceFidelity}%</span>
        </div>
         <div style={styles.sliderContainer}>
            <label htmlFor="colorMatching" style={{flexBasis: '120px'}}>Color Matching:</label>
            <input id="colorMatching" type="range" min="0" max="100" value={colorMatching} onChange={e => setColorMatching(Number(e.target.value))} style={styles.slider} aria-label="Color matching percentage" />
            <span>{colorMatching}%</span>
        </div>
        <h2 style={styles.sectionTitle}>4. Add Guidance (Optional)</h2>
        <div style={styles.promptContainer}>
            <textarea style={{...styles.promptInput, paddingRight: '50px'}} placeholder="e.g., match the expression of the source image, adjust skin tone slightly..." aria-label="Face swap guidance" value={faceSwapPrompt} onChange={(e) => setFaceSwapPrompt(e.target.value)} />
            <button onClick={() => handleEnhancePrompt(faceSwapPrompt, setFaceSwapPrompt, 'face swapping')} disabled={isEnhancing || !faceSwapPrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
    </div>
);

const InpaintingControls = ({ styles, inpaintImage, handleInpaintImageUpload, setInpaintImage, brushSize, setBrushSize, brushShape, setBrushShape, setInpaintMask, inpaintPrompt, setInpaintPrompt, handleEnhancePrompt, isEnhancing, inpaintCreativity, setInpaintCreativity }) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <h2 style={styles.sectionTitle}>1. Load Image to Edit</h2>
        {!inpaintImage ? (
             <ImageUploader styles={styles} image={inpaintImage} onUpload={handleInpaintImageUpload} onRemove={() => setInpaintImage(null)} label="Upload Image" />
        ) : (
            <div>
                 <p style={{marginBottom: '0.5rem', color: 'var(--on-surface-color)'}}>Draw a mask on the area you want to replace.</p>
                 <MaskingCanvas styles={styles} sourceImage={inpaintImage} brushSize={brushSize} setBrushSize={setBrushSize} brushShape={brushShape} setBrushShape={setBrushShape} onMaskChange={setInpaintMask} onClear={() => setInpaintMask(null)} />
            </div>
        )}
        <h2 style={styles.sectionTitle}>2. Describe Your Edit</h2>
        <div style={styles.promptContainer}>
            <textarea style={{...styles.promptInput, paddingRight: '50px'}} placeholder="e.g., add a superhero mask, change hair to blue, remove the person..." aria-label="Inpainting prompt" value={inpaintPrompt} onChange={(e) => setInpaintPrompt(e.target.value)} />
             <button onClick={() => handleEnhancePrompt(inpaintPrompt, setInpaintPrompt, 'inpainting or editing an image')} disabled={isEnhancing || !inpaintPrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
        <h2 style={styles.sectionTitle}>3. Advanced Controls</h2>
         <div style={styles.sliderContainer}>
            <label htmlFor="inpaintCreativity" style={{flexBasis: '120px'}}>Creativity:</label>
            <input id="inpaintCreativity" type="range" min="0" max="100" value={inpaintCreativity} onChange={e => setInpaintCreativity(Number(e.target.value))} style={styles.slider} aria-label="Inpainting creativity percentage" />
            <span>{inpaintCreativity}%</span>
        </div>
    </div>
);

const VideoControls = ({ styles, videoImages, handleVideoImageUpload, handleRemoveVideoImage, handleAddVideoImageSlot, videoFaceRefImage, setVideoFaceRefImage, videoStyleImage, setVideoStyleImage, videoBlendMode, setVideoBlendMode, BLEND_MODES, videoPrompt, setVideoPrompt, handleEnhancePrompt, isEnhancing, videoDialogue, setVideoDialogue }) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <h2 style={styles.sectionTitle}>1. Upload Source Images (1-4)</h2>
        <div style={styles.imageUploads}>
            {videoImages.map((image, index) => ( <ImageUploader styles={styles} key={index} image={image} onUpload={(e) => handleVideoImageUpload(e, index)} onRemove={() => handleRemoveVideoImage(index)} label={`Image ${index + 1}`} /> ))}
            {videoImages.length < 4 && ( <button onClick={handleAddVideoImageSlot} style={styles.addImageButton} className="addImageButton" aria-label="Add another image slot">+</button> )}
        </div>

        <h2 style={styles.sectionTitle}>2. Upload References (Optional)</h2>
        <p style={{marginTop: '-1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-color)'}}>
            Add a face reference for character consistency and a style image to guide the artistic direction.
        </p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '260px'}}>
             <ImageUploader styles={styles} image={videoFaceRefImage} onUpload={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setVideoFaceRefImage(reader.result as string);
                    reader.readAsDataURL(file);
                }
            }} onRemove={() => setVideoFaceRefImage(null)} label="Face Ref" />
             <ImageUploader styles={styles} image={videoStyleImage} onUpload={(e) => {
                const file = e.target.files?.[0];
                if(file) {
                    const reader = new FileReader();
                    reader.onloadend = () => setVideoStyleImage(reader.result as string);
                    reader.readAsDataURL(file);
                }
            }} onRemove={() => setVideoStyleImage(null)} label="Style Image" />
        </div>

        <h2 style={styles.sectionTitle}>3. Choose Video Mood</h2>
        <div style={styles.blendModes}>
            {BLEND_MODES.map(mode => (
                <div key={mode.name} onClick={() => setVideoBlendMode(mode.name)} style={{...styles.blendCard, ...(videoBlendMode === mode.name ? styles.blendCardSelected : {})}} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && setVideoBlendMode(mode.name)} aria-pressed={videoBlendMode === mode.name} className="blend-card">
                    <h4 style={styles.blendCardTitle}>{mode.name}</h4>
                    <p style={styles.blendCardDescription}>{mode.description}</p>
                </div>
            ))}
        </div>

        <h2 style={styles.sectionTitle}>4. Describe Your Video</h2>
        <div style={styles.promptContainer}>
            <textarea 
                style={{...styles.promptInput, paddingRight: '50px'}} 
                placeholder="e.g., A close-up of a news anchor reporting from a studio." 
                aria-label="Video description prompt" 
                value={videoPrompt} 
                onChange={(e) => setVideoPrompt(e.target.value)} 
            />
             <button onClick={() => handleEnhancePrompt(videoPrompt, setVideoPrompt, 'video generation')} disabled={isEnhancing || !videoPrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
        
        <h2 style={styles.sectionTitle}>5. Add Dialogue (Optional)</h2>
        <p style={{marginTop: '-1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-color)'}}>
            Enter text for a character to speak. The AI will attempt to generate matching lip movements.
        </p>
        <textarea 
            style={styles.promptInput} 
            placeholder="e.g., Good evening, and welcome to the nightly news." 
            aria-label="Dialogue for lip-sync" 
            value={videoDialogue} 
            onChange={(e) => setVideoDialogue(e.target.value)} 
        />
    </div>
);

const StyleTransferControls = ({ styles, styleContentImage, handleStyleImageUpload, setStyleContentImage, styleStyleImage, setStyleStyleImage, styleStrength, setStyleStrength, stylePrompt, setStylePrompt, handleEnhancePrompt, isEnhancing }) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <h2 style={styles.sectionTitle}>1. Upload Images</h2>
         <p style={{marginTop: '-1rem', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--on-surface-color)'}}>
            Upload a content image and an image whose style you want to apply.
        </p>
        <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <ImageUploader styles={styles} image={styleContentImage} onUpload={(e) => handleStyleImageUpload(e, 'content')} onRemove={() => setStyleContentImage(null)} label="Content Image" />
            <ImageUploader styles={styles} image={styleStyleImage} onUpload={(e) => handleStyleImageUpload(e, 'style')} onRemove={() => setStyleStyleImage(null)} label="Style Image" />
        </div>
        <h2 style={styles.sectionTitle}>2. Style Strength</h2>
         <div style={styles.sliderContainer}>
            <label htmlFor="styleStrength" style={{flexBasis: '120px'}}>Strength:</label>
            <input id="styleStrength" type="range" min="0" max="100" value={styleStrength} onChange={e => setStyleStrength(Number(e.target.value))} style={styles.slider} aria-label="Style transfer strength" />
            <span>{styleStrength}%</span>
        </div>
        <h2 style={styles.sectionTitle}>3. Add Guidance (Optional)</h2>
        <div style={styles.promptContainer}>
            <textarea style={{...styles.promptInput, paddingRight: '50px'}} placeholder="e.g., emphasize the brush strokes, focus on the color palette..." aria-label="Style transfer guidance" value={stylePrompt} onChange={(e) => setStylePrompt(e.target.value)} />
            <button onClick={() => handleEnhancePrompt(stylePrompt, setStylePrompt, 'style transfer')} disabled={isEnhancing || !stylePrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
    </div>
);

const AudioControls = ({ styles, audioPrompt, setAudioPrompt, handleEnhancePrompt, isEnhancing, voiceType, setVoiceType, VOICE_TYPES }) => (
    <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
        <h2 style={styles.sectionTitle}>1. Describe Sound or Dialogue</h2>
        <div style={styles.promptContainer}>
            <textarea 
                style={{...styles.promptInput, paddingRight: '50px'}} 
                placeholder="e.g., 'A dramatic movie trailer voice saying...', or 'sound of a futuristic spaceship door opening'." 
                aria-label="Audio description prompt" 
                value={audioPrompt} 
                onChange={(e) => setAudioPrompt(e.target.value)} 
            />
             <button onClick={() => handleEnhancePrompt(audioPrompt, setAudioPrompt, 'audio generation')} disabled={isEnhancing || !audioPrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
            </button>
        </div>
        <h2 style={styles.sectionTitle}>2. Select Voice/Sound Type</h2>
        <select style={styles.selectInput} value={voiceType} onChange={e => setVoiceType(e.target.value)} aria-label="Select voice or sound type">
            {VOICE_TYPES.map(type => ( <option key={type} value={type}>{type}</option>))}
        </select>
         <p style={{marginTop: '1rem', fontSize: '0.9rem', color: 'var(--secondary-color)', textAlign: 'center', textShadow: '0 0 5px var(--secondary-color)'}}>
            Note: Audio generation is an experimental feature. The UI is in place for future integration.
        </p>
    </div>
);

function isPrime(num: number) {
    for(let i = 2, s = Math.sqrt(num); i <= s; i++)
        if(num % i === 0) return false;
    return num > 1;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs((h / 60) % 2 - 1));
    let m = l - c / 2;
    let r = 0, g = 0, b = 0;

    if (0 <= h && h < 60) { r = c; g = x; b = 0; }
    else if (60 <= h && h < 120) { r = x; g = c; b = 0; }
    else if (120 <= h && h < 180) { r = 0; g = c; b = x; }
    else if (180 <= h && h < 240) { r = 0; g = x; b = c; }
    else if (240 <= h && h < 300) { r = x; g = 0; b = c; }
    else if (300 <= h && h < 360) { r = c; g = 0; b = x; }
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);

    return [r, g, b];
}

function getNextPrime(num: number) {
    while(true) {
        num++;
        if(isPrime(num)) return num;
    }
}
function getPrevPrime(num: number) {
    while(true) {
        num--;
        if(isPrime(num)) return num;
    }
}

const GenesisEngineControls = React.forwardRef(({ styles, genesisPrompt, setGenesisPrompt, handleEnhancePrompt, isEnhancing, useGoldenRatio, setUseGoldenRatio }: { styles: { [key: string]: React.CSSProperties }, genesisPrompt: string, setGenesisPrompt: (p: string) => void, handleEnhancePrompt: (p: string, s: any, c: string) => void, isEnhancing: boolean, useGoldenRatio: boolean, setUseGoldenRatio: (u: boolean) => void }, ref) => {
    const { mandelbrotRef, compositionRef } = ref as { mandelbrotRef: React.Ref<HTMLCanvasElement>, compositionRef: React.Ref<HTMLCanvasElement> };
    const [rValue, setRValue] = useState(3.9);
    const [palette, setPalette] = useState<[number, number, number][]>([]);
    const [primeCount, setPrimeCount] = useState(7);
    const maxIter = 150;

    const generateChaosPalette = useCallback(() => {
        const newPalette: [number, number, number][] = [];
        let x = 0.5; // Initial value for logistic map

        // "Warm up" the logistic map
        for (let i = 0; i < 100; i++) {
            x = rValue * x * (1 - x);
        }

        for (let i = 0; i < maxIter; i++) {
            x = rValue * x * (1 - x);
            const hue = Math.floor(x * 360);
            const saturation = 70 + Math.floor(x * 30);
            const lightness = 50;
            newPalette.push(hslToRgb(hue, saturation, lightness));
        }
        setPalette(newPalette);
    }, [rValue, maxIter]);

    // Generate initial palette
    useEffect(() => {
        generateChaosPalette();
    }, [generateChaosPalette]);

    // Redraw Mandelbrot when palette changes
    useEffect(() => {
        if (palette.length === 0) return;

        const canvas = (mandelbrotRef as React.RefObject<HTMLCanvasElement>).current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;

        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let zx = 1.5 * (x - width / 2) / (0.5 * width);
                let zy = (y - height / 2) / (0.5 * height);

                let zx_iter = 0;
                let zy_iter = 0;
                const cx = zx;
                const cy = zy;

                let iter = 0;
                while (zx_iter * zx_iter + zy_iter * zy_iter < 4 && iter < maxIter) {
                    const xtemp = zx_iter * zx_iter - zy_iter * zy_iter + cx;
                    zy_iter = 2 * zx_iter * zy_iter + cy;
                    zx_iter = xtemp;
                    iter++;
                }

                const pixelIndex = (y * width + x) * 4;
                if (iter === maxIter) {
                    data[pixelIndex] = 0; data[pixelIndex + 1] = 0; data[pixelIndex + 2] = 0; data[pixelIndex + 3] = 255;
                } else {
                    const color = palette[iter];
                    data[pixelIndex] = color[0];
                    data[pixelIndex + 1] = color[1];
                    data[pixelIndex + 2] = color[2];
                    data[pixelIndex + 3] = 255;
                }
            }
        }
        ctx.putImageData(imageData, 0, 0);

    }, [palette, maxIter]);

    useEffect(() => {
        const canvas = (compositionRef as React.RefObject<HTMLCanvasElement>).current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;

        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        // Simple LCG pseudo-random number generator, seeded with primeCount
        let seed = primeCount;
        const random = () => {
            seed = (seed * 1664525 + 1013904223) % 4294967296;
            return seed / 4294967296;
        };

        ctx.strokeStyle = 'rgba(57, 255, 20, 0.7)';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(57, 255, 20, 0.2)';

        for (let i = 0; i < primeCount; i++) {
            const x = random() * width;
            const y = random() * height;
            const radius = (random() * 20) + 5; // Radius between 5 and 25

            ctx.beginPath();
            ctx.arc(x, y, radius, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.fill();
        }
    }, [primeCount]);

    return (
        <div style={{display: 'flex', flexDirection: 'column', gap: '1.5rem'}}>
            <h2 style={styles.sectionTitle}>1. Fractal & Chaos Configuration</h2>
            <div style={{...styles.sliderContainer, flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem'}}>
                <label htmlFor="rValue">Chaos Parameter (r): {rValue.toFixed(2)}</label>
                <p style={{fontSize: '0.8rem', color: 'var(--on-surface-color)', margin: '0 0 0.5rem'}}>Controls the color palette generation. Values between 3.6 and 4.0 are typically chaotic.</p>
                <input
                    id="rValue"
                    type="range"
                    min="3.5"
                    max="4.0"
                    step="0.01"
                    value={rValue}
                    onChange={e => setRValue(Number(e.target.value))}
                    style={styles.slider}
                    aria-label="Chaos parameter r"
                />
            </div>
             <button onClick={generateChaosPalette} style={{...styles.actionButton, ...styles.secondaryActionButton}}>Regenerate Palette</button>

            <h2 style={styles.sectionTitle}>2. Composition & Framing</h2>
            <div style={{...styles.sliderContainer, flexDirection: 'column', alignItems: 'flex-start', gap: '0.5rem'}}>
                <label htmlFor="primeCount">Composition Elements (Prime Number):</label>
                <p style={{fontSize: '0.8rem', color: 'var(--on-surface-color)', margin: '0 0 0.5rem'}}>Guides the placement and scale of core visual elements.</p>
                <div style={{...styles.sliderContainer, width: '100%'}}>
                    <button onClick={() => setPrimeCount(p => getPrevPrime(p))} disabled={primeCount <= 2} style={{...styles.actionButton, ...styles.secondaryActionButton}}>&lt;</button>
                    <span style={{flexGrow: 1, textAlign: 'center', fontSize: '1.2rem', color: 'var(--primary-color)'}}>{primeCount}</span>
                    <button onClick={() => setPrimeCount(p => getNextPrime(p))} disabled={primeCount >= 97} style={{...styles.actionButton, ...styles.secondaryActionButton}}>&gt;</button>
                </div>
            </div>
            <div style={{display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '1rem'}}>
                <label htmlFor="goldenRatio" style={{ flexGrow: 1 }}>Use Golden Ratio ($\phi$) Framing:</label>
                <input
                    id="goldenRatio"
                    type="checkbox"
                    checked={useGoldenRatio}
                    onChange={e => setUseGoldenRatio(e.target.checked)}
                    style={{ width: '24px', height: '24px', accentColor: 'var(--primary-color)' }}
                />
            </div>

            <h2 style={styles.sectionTitle}>3. Add Guidance (Optional)</h2>
            <div style={styles.promptContainer}>
                <textarea
                    style={{...styles.promptInput, paddingRight: '50px'}}
                    placeholder="e.g., a vibrant nebula, a city of light, a single eye looking back..."
                    aria-label="Genesis Engine Guidance"
                    value={genesisPrompt}
                    onChange={(e) => setGenesisPrompt(e.target.value)}
                />
                 <button onClick={() => handleEnhancePrompt(genesisPrompt, setGenesisPrompt, 'a mathematically generated artwork')} disabled={isEnhancing || !genesisPrompt} style={styles.enhancerButton} className="enhancer-button" title="Enhance prompt with AI">
                    {isEnhancing ? <div style={styles.miniSpinner}></div> : '✨'}
                </button>
            </div>

            <h2 style={{...styles.sectionTitle, marginTop: '1rem'}}>4. Latent Seed Preview</h2>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '1/1' }}>
                <canvas ref={mandelbrotRef} width="400" height="400" style={{ border: '1px solid var(--border-color)', width: '100%', background: '#000', position: 'absolute', top: 0, left: 0 }}></canvas>
                <canvas ref={compositionRef} width="400" height="400" style={{ width: '100%', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}></canvas>
            </div>
        </div>
    );
});


// #endregion

const cropImageToGoldenRatio = (base64Url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const goldenRatio = 1.618;
            const originalRatio = img.width / img.height;

            let sx, sy, sWidth, sHeight;

            if (originalRatio > goldenRatio) {
                // Image is wider than the golden ratio, so crop the sides
                sHeight = img.height;
                sWidth = img.height * goldenRatio;
                sx = (img.width - sWidth) / 2;
                sy = 0;
            } else {
                // Image is taller or equal to the golden ratio, so crop the top and bottom
                sWidth = img.width;
                sHeight = img.width / goldenRatio;
                sx = 0;
                sy = (img.height - sHeight) / 2;
            }

            const canvas = document.createElement('canvas');
            canvas.width = sWidth;
            canvas.height = sHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Could not get canvas context for cropping.'));
            }
            ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = (err) => {
            reject(new Error('Failed to load image for cropping.'));
        };
        img.src = base64Url;
    });
};

const App = () => {
    const [activeTab, setActiveTab] = useState<'blend' | 'swap' | 'inpaint' | 'video' | 'style' | 'audio' | 'genesis'>('blend');
    
    // State for Image Blending
    const initialBlendImage = { src: null, instruction: '', transform: { scale: 1, x: 0, y: 0 } };
    const [blendImages, setBlendImages] = useState<{ src: string | null; instruction: string; transform: ImageTransform }[]>([
        { ...initialBlendImage }, { ...initialBlendImage }
    ]);
    const [blendFaceRefImage, setBlendFaceRefImage] = useState<string | null>(null);
    const [blendMode, setBlendMode] = useState<string>('');
    const [technicalBlendMode, setTechnicalBlendMode] = useState<string>('Normal');
    const [prompt, setPrompt] = useState<string>('');
    const [selectedModel, setSelectedModel] = useState<string>('imagen-4.0-generate-001');
    const [aspectRatio, setAspectRatio] = useState<string>('1:1');
    const [numberOfImages, setNumberOfImages] = useState(1);
    
    // State for Face Swap
    const [sourceImage, setSourceImage] = useState<string | null>(null);
    const [faceRefImage, setFaceRefImage] = useState<string | null>(null);
    const [faceSwapPrompt, setFaceSwapPrompt] = useState<string>('');
    const [mask, setMask] = useState<string | null>(null);
    const [brushSize, setBrushSize] = useState(40);
    const [brushShape, setBrushShape] = useState<'round' | 'square'>('round');
    const [faceFidelity, setFaceFidelity] = useState(75);
    const [colorMatching, setColorMatching] = useState(75);

    // State for Inpainting
    const [inpaintImage, setInpaintImage] = useState<string | null>(null);
    const [inpaintMask, setInpaintMask] = useState<string | null>(null);
    const [inpaintPrompt, setInpaintPrompt] = useState<string>('');
    const [inpaintCreativity, setInpaintCreativity] = useState(50);

    // State for Video Generation
    const [videoImages, setVideoImages] = useState<(string | null)[]>([null]);
    const [videoFaceRefImage, setVideoFaceRefImage] = useState<string | null>(null);
    const [videoStyleImage, setVideoStyleImage] = useState<string | null>(null);
    const [videoBlendMode, setVideoBlendMode] = useState<string>('');
    const [videoPrompt, setVideoPrompt] = useState<string>('');
    const [videoDialogue, setVideoDialogue] = useState<string>('');
    const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
    const [videoQueue, setVideoQueue] = useState<VideoQueueItem[]>([]);
    const [currentlyProcessingVideoId, setCurrentlyProcessingVideoId] = useState<string | null>(null);
    
    // State for Style Transfer
    const [styleContentImage, setStyleContentImage] = useState<string | null>(null);
    const [styleStyleImage, setStyleStyleImage] = useState<string | null>(null);
    const [styleStrength, setStyleStrength] = useState<number>(75);
    const [stylePrompt, setStylePrompt] = useState<string>('');
    
    // State for Audio Generation
    const [audioPrompt, setAudioPrompt] = useState<string>('');
    const [voiceType, setVoiceType] = useState<string>('Narrator (Male)');
    const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);

    // State for Genesis Engine
    const [genesisPrompt, setGenesisPrompt] = useState<string>('');
    const [useGoldenRatio, setUseGoldenRatio] = useState(true);
    const mandelbrotCanvasRef = useRef<HTMLCanvasElement>(null);
    const compositionCanvasRef = useRef<HTMLCanvasElement>(null);

    // General State
    const [loading, setLoading] = useState<boolean>(false);
    const loadingIntervalRef = useRef<number | null>(null);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [generatedImages, setGeneratedImages] = useState<string[]>([]);
    const [generatedImage, setGeneratedImage] = useState<string | null>(null); // The selected image
    const [generatedImageMetadata, setGeneratedImageMetadata] = useState<{name: string, tags: string[]} | null>(null);
    const [isMetadataLoading, setIsMetadataLoading] = useState<boolean>(false);
    const [sessionGallery, setSessionGallery] = useState<SessionGalleryItem[]>([]);
    const [galleryFilter, setGalleryFilter] = useState<string>('all');
    const [gallerySort, setGallerySort] = useState<'newest' | 'oldest'>('newest');
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const [isEnhancing, setIsEnhancing] = useState(false);

    const playSound = useCallback((type: 'start' | 'finish' | 'error') => {
        if (!soundEnabled) return;
        if (!audioCtxRef.current) {
            try {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.error("AudioContext not supported.", e);
                return;
            }
        }
        const audioCtx = audioCtxRef.current;
        if (!audioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

        if (type === 'start') {
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(120, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
            oscillator.frequency.exponentialRampToValueAtTime(60, audioCtx.currentTime + 0.1);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.1);
        } else if (type === 'finish') {
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.2);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.2);
            const oscillator2 = audioCtx.createOscillator();
            const gainNode2 = audioCtx.createGain();
            oscillator2.connect(gainNode2);
            gainNode2.connect(audioCtx.destination);
            oscillator2.type = 'sine';
            oscillator2.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.1);
            gainNode2.gain.setValueAtTime(0, audioCtx.currentTime + 0.1);
            gainNode2.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.11);
            gainNode2.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
            oscillator2.start(audioCtx.currentTime + 0.1);
            oscillator2.stop(audioCtx.currentTime + 0.3);
        } else if (type === 'error') {
            oscillator.type = 'square';
            oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
            gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.3);
            oscillator.start(audioCtx.currentTime);
            oscillator.stop(audioCtx.currentTime + 0.3);
        }
    }, [soundEnabled]);

    const ai = useMemo(() => new GoogleGenAI({ apiKey: process.env.API_KEY }), []);

    const BLEND_MODES = [
        { name: 'Fusion', description: 'Smoothly merges concepts and aesthetics into a cohesive whole.' },
        { name: 'Surreal Collage', description: 'Creates a dreamlike composition with artistic juxtapositions.' },
        { name: 'Painterly Blend', description: 'Reimagines inputs with classical brushwork and texture.' },
        { name: 'Photorealistic Composite', description: 'Seamlessly integrates elements into a single, believable photograph.' },
        { name: 'Graphic Mashup', description: 'Bold, pop-art style with sharp lines and vibrant colors.' },
    ];

    const TECHNICAL_BLEND_MODES = ['Normal', 'Multiply', 'Screen', 'Overlay', 'Soft Light', 'Hard Light'];
    const ASPECT_RATIOS = ["1:1", "16:9", "9:16", "4:3", "3:4"];
    const GENERATION_MODELS = [{ id: 'imagen-4.0-generate-001', name: 'Imagen 4' }];
    const VOICE_TYPES = ['Narrator (Male)', 'Narrator (Female)', 'Character (Young)', 'Character (Old)', 'Robotic', 'Sound Effect'];
    
    const startLoadingAnimation = (messages: string[], interval = 3000) => {
        let messageIndex = 0;
        setLoadingMessage(messages[messageIndex]);
        if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
        loadingIntervalRef.current = window.setInterval(() => {
            messageIndex = (messageIndex + 1) % messages.length;
            setLoadingMessage(messages[messageIndex]);
        }, interval);
    };

    const stopLoadingAnimation = () => {
        if (loadingIntervalRef.current) {
            clearInterval(loadingIntervalRef.current);
            loadingIntervalRef.current = null;
        }
        setLoading(false);
        setLoadingMessage('');
    };

    const handleGenerateMetadata = async () => {
        if (!generatedImage) return;

        setIsMetadataLoading(true);
        setError(null);
        try {
            const mimeType = generatedImage.split(';')[0].split(':')[1];
            const data = generatedImage.split(',')[1];
            
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { inlineData: { mimeType, data } },
                        { text: 'Analyze this image. Generate a creative, descriptive 3-word file name and 3-4 relevant metadata tags for searching. The name should be lowercase with words separated by hyphens.' }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "surreal-cat-portrait".' },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                        },
                        required: ['name', 'tags']
                    }
                }
            });
            const metadata = JSON.parse(response.text);
            setGeneratedImageMetadata(metadata);
        } catch (err) {
            console.error("Failed to generate metadata:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while generating metadata.');
            setGeneratedImageMetadata(null);
        } finally {
            setIsMetadataLoading(false);
        }
    };
    
    const handleGenerateVideoMetadata = async () => {
        if (!videoPrompt) return;

        setIsMetadataLoading(true);
        setError(null);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { text: `Based on this video description, generate a creative, descriptive 3-word file name and 3-4 relevant metadata tags for searching. The name should be lowercase with words separated by hyphens. Description: "${videoPrompt} ${videoDialogue}"` }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "futuristic-city-scape".' },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                        },
                        required: ['name', 'tags']
                    }
                }
            });
            const metadata = JSON.parse(response.text);
            setGeneratedImageMetadata(metadata);
        } catch (err) {
            console.error("Failed to generate metadata:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while generating metadata.');
            setGeneratedImageMetadata(null);
        } finally {
            setIsMetadataLoading(false);
        }
    };

    const handleGenerateAudioMetadata = async () => {
        if (!audioPrompt) return;

        setIsMetadataLoading(true);
        setError(null);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: {
                    parts: [
                        { text: `Based on this audio description, generate a creative, descriptive 3-word file name and 3-4 relevant search tags. The name should be lowercase with words separated by hyphens. Description: "${audioPrompt}"` }
                    ]
                },
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING, description: 'A 3-word lowercase file name, e.g., "deep-space-ambience".' },
                            tags: { type: Type.ARRAY, items: { type: Type.STRING }, description: 'An array of 3-4 string tags.' }
                        },
                        required: ['name', 'tags']
                    }
                }
            });
            const metadata = JSON.parse(response.text);
            setGeneratedImageMetadata(metadata);
        } catch (err) {
            console.error("Failed to generate metadata:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred while generating metadata.');
            setGeneratedImageMetadata(null);
        } finally {
            setIsMetadataLoading(false);
        }
    };


    const handleEnhancePrompt = async (promptToEnhance: string, promptSetter: React.Dispatch<React.SetStateAction<string>>, context: string) => {
        if (!promptToEnhance || isEnhancing) return;
        setIsEnhancing(true);
        setError(null);
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `You are an expert prompt engineer for generative AI. Your task is to take a user's idea and expand it into a rich, detailed, and evocative prompt. Your enhanced prompt should include specific keywords for style (e.g., 'cinematic lighting', 'impressionistic'), mood, and composition (e.g., 'low-angle shot', 'dutch angle'), and be structured for maximum impact. Return ONLY the enhanced prompt, without any conversational text or markdown.
                
                Context: The user wants to generate content for "${context}".
                
                User's Prompt: "${promptToEnhance}"`
            });
            promptSetter(response.text.trim().replace(/^"|"$/g, '')); // Update state and remove quotes
        } catch (err) {
            console.error("Failed to enhance prompt:", err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during prompt enhancement.');
        } finally {
            setIsEnhancing(false);
        }
    }

    const handleBlendImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImages = [...blendImages];
                newImages[index].src = reader.result as string;
                newImages[index].transform = { scale: 1, x: 0, y: 0 }; // Reset transform on new upload
                setBlendImages(newImages);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleBlendImageTransformChange = (index: number, newTransform: ImageTransform) => {
        const newImages = [...blendImages];
        newImages[index].transform = newTransform;
        setBlendImages(newImages);
    };

    const handleBlendImageInstructionChange = (index: number, instruction: string) => {
        const newImages = [...blendImages];
        newImages[index].instruction = instruction;
        setBlendImages(newImages);
    };

    const handleVideoImageUpload = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const newImages = [...videoImages];
                newImages[index] = reader.result as string;
                setVideoImages(newImages);
            };
            reader.readAsDataURL(file);
        }
    };

     const handleSourceImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setSourceImage(reader.result as string);
                setMask(null); // Reset mask when new image is uploaded
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleFaceRefUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setFaceRefImage(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleInpaintImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setInpaintImage(reader.result as string);
                setInpaintMask(null);
            };
            reader.readAsDataURL(file);
        }
    };
    
    const handleStyleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'content' | 'style') => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                const result = reader.result as string;
                if (type === 'content') setStyleContentImage(result);
                else setStyleStyleImage(result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleRemoveBlendImage = (indexToRemove: number) => {
        setBlendImages(blendImages.filter((_, index) => index !== indexToRemove));
    };

    const handleRemoveVideoImage = (indexToRemove: number) => {
        const newImages = videoImages.map((img, index) => index === indexToRemove ? null : img);
        setVideoImages(newImages);
    };

    const handleAddBlendImageSlot = () => {
        if (blendImages.length < 5) {
            setBlendImages([...blendImages, { ...initialBlendImage }]);
        }
    };

    const handleAddVideoImageSlot = () => {
        if (videoImages.length < 4) {
            setVideoImages([...videoImages, null]);
        }
    };
    
    const handleReset = () => {
        if (activeTab === 'blend') {
            setBlendImages([{ ...initialBlendImage }, { ...initialBlendImage }]);
            setBlendFaceRefImage(null);
            setBlendMode('');
            setTechnicalBlendMode('Normal');
            setPrompt('');
            setAspectRatio('1:1');
            setNumberOfImages(1);
        } else if (activeTab === 'swap') {
            setSourceImage(null);
            setFaceRefImage(null);
            setFaceSwapPrompt('');
            setMask(null);
            setFaceFidelity(75);
            setColorMatching(75);
        } else if (activeTab === 'inpaint') {
            setInpaintImage(null);
            setInpaintMask(null);
            setInpaintPrompt('');
            setInpaintCreativity(50);
        } else if (activeTab === 'video') {
            setVideoImages([null]);
            setVideoFaceRefImage(null);
            setVideoStyleImage(null);
            setVideoBlendMode('');
            setVideoPrompt('');
            setVideoDialogue('');
            setVideoQueue([]);
            setCurrentlyProcessingVideoId(null);
        } else if (activeTab === 'style') {
            setStyleContentImage(null);
            setStyleStyleImage(null);
            setStyleStrength(75);
            setStylePrompt('');
        } else if (activeTab === 'audio') {
            setAudioPrompt('');
            setVoiceType('Narrator (Male)');
        } else if (activeTab === 'genesis') {
            // Add reset logic for genesis tab here in the future
        }
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        setError(null);
        stopLoadingAnimation();
    };
    
    const handleSaveToSession = () => {
        if (generatedImage && generatedImageMetadata && !sessionGallery.some(item => item.src === generatedImage)) {
            const newItem: SessionGalleryItem = {
                src: generatedImage,
                mediaType: 'image',
                name: generatedImageMetadata.name,
                tags: generatedImageMetadata.tags,
                date: new Date(),
                type: activeTab as 'blend' | 'swap' | 'inpaint' | 'style' | 'genesis',
                blendMode: activeTab === 'blend' ? blendMode : null,
                aspectRatio: activeTab === 'blend' ? aspectRatio : '1:1',
            };
            setSessionGallery([newItem, ...sessionGallery]);
        } else if (generatedVideoUrl && generatedImageMetadata && !sessionGallery.some(item => item.src === generatedVideoUrl)) {
            const newItem: SessionGalleryItem = {
                src: generatedVideoUrl,
                mediaType: 'video',
                name: generatedImageMetadata.name,
                tags: generatedImageMetadata.tags,
                date: new Date(),
                type: 'video',
                blendMode: null,
                aspectRatio: '16:9',
            };
            setSessionGallery([newItem, ...sessionGallery]);
        } else if (generatedAudioUrl && generatedImageMetadata && !sessionGallery.some(item => item.src === generatedAudioUrl)) {
            const newItem: SessionGalleryItem = {
                src: generatedAudioUrl,
                mediaType: 'audio',
                name: generatedImageMetadata.name,
                tags: generatedImageMetadata.tags,
                date: new Date(),
                type: 'audio',
                blendMode: null,
                aspectRatio: 'N/A',
            };
            setSessionGallery([newItem, ...sessionGallery]);
        }
    };

    const handleLoadToInpainting = (src: string) => {
        setActiveTab('inpaint');
        setInpaintImage(src);
        setInpaintMask(null);
        setInpaintPrompt('');
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setError(null);
    };

    const handleAddToVideoGen = (imageSrc: string) => {
        if (!imageSrc) return;
        
        const newVideoImages = [...videoImages];
        const emptyIndex = newVideoImages.indexOf(null);

        if (emptyIndex !== -1) {
            newVideoImages[emptyIndex] = imageSrc;
        } else if (newVideoImages.length < 4) {
            newVideoImages.push(imageSrc);
        } else {
            newVideoImages[0] = imageSrc; // Replace the first image if all slots are full
        }
        
        setVideoImages(newVideoImages);
        setActiveTab('video');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    
    const getNoImageError = (response: GenerateContentResponse): Error => {
        const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text)?.text;
        let errorMessage = 'Generation succeeded, but the model did not return an image.';
        if (textPart) {
            errorMessage += ` Model response: "${textPart}"`;
        } else {
            errorMessage += ' This might be due to safety filters. Please try modifying your prompt or images.';
        }
        return new Error(errorMessage);
    };

    const handleInpaintGenerate = async () => {
        if (!inpaintImage || !inpaintMask || !inpaintPrompt) {
            setError('Please provide an image, draw a mask, and enter a prompt.');
            return;
        }
        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Analyzing pixel context...', 'Weaving new reality...', 'Blending textures and light...', 'Making the impossible, possible...']);

        try {
            const creativityPrompt = `Apply this with ${inpaintCreativity}% creativity, where 100% is maximum artistic freedom and 0% is a very literal interpretation.`;
            const fullPrompt = `You are a master digital artist specializing in photorealistic inpainting. Your task is to seamlessly edit an image based on a user's prompt and a mask. The first image is the source. The second image is the mask. You must edit the source image ONLY in the area indicated by the mask. Your edits should blend perfectly with the surrounding image, matching lighting, shadows, and texture. The user wants to: '${inpaintPrompt}'. ${creativityPrompt}`;

            const sourceImagePart = { inlineData: { mimeType: inpaintImage.split(';')[0].split(':')[1], data: inpaintImage.split(',')[1] } };
            const maskPart = { inlineData: { mimeType: 'image/png', data: inpaintMask.split(',')[1] } };

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [sourceImagePart, maskPart, { text: fullPrompt }] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                let finalImage = `data:${mimeType};base64,${base64ImageBytes}`;

                if (useGoldenRatio) {
                    finalImage = await cropImageToGoldenRatio(finalImage);
                }

                setGeneratedImage(finalImage);
                setGeneratedImages([finalImage]);
                playSound('finish');
            } else {
                throw getNoImageError(response);
            }
        } catch(err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during inpainting.');
        } finally {
            stopLoadingAnimation();
        }
    };
    
    const handleFaceSwapGenerate = async () => {
        if (!sourceImage || !faceRefImage) {
            setError('Please upload a source image and a face to swap.');
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Mapping facial vectors...', 'Calibrating skin tones...', 'Seamlessly integrating features...', 'Performing digital surgery...']);
        
        try {
            const newPrompt = `You are an expert in digital image manipulation. Your task is to perform a photorealistic face swap. Replace the face in the first image (the source) with the face from the ${mask ? 'third' : 'second'} image (the reference face). ${mask ? 'The second image is a mask indicating the exact area on the source image where the swap should occur.' : ''} The final image must be seamless. Match the reference face features with ${faceFidelity}% fidelity. Adapt the lighting and skin tone to the source image with ${colorMatching}% intensity. Apply the user's guidance: '${faceSwapPrompt || 'Ensure the result is photorealistic and natural.'}'`;
            
            const sourceImagePart = { inlineData: { mimeType: sourceImage.split(';')[0].split(':')[1], data: sourceImage.split(',')[1] } };
            const faceRefPart = { inlineData: { mimeType: faceRefImage.split(';')[0].split(':')[1], data: faceRefImage.split(',')[1] } };
            
            const parts = [
                sourceImagePart,
                ...(mask ? [{ inlineData: { mimeType: 'image/png', data: mask.split(',')[1] } }] : []),
                faceRefPart,
                { text: newPrompt },
            ];

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });
            
            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
                setGeneratedImage(newImage);
                setGeneratedImages([newImage]);
                playSound('finish');
            } else {
                 throw getNoImageError(response);
            }

        } catch(err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during face swap generation.');
        } finally {
            stopLoadingAnimation();
        }
    };

    const handleBlendGenerate = async () => {
        const validImages = blendImages.filter(img => img.src);
        if (validImages.length < 2 || !blendMode) {
            setError('Please upload at least two images and select a blend style.');
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Analyzing image matrix...', 'Harmonizing aesthetics...', 'Painting with light...', 'Finalizing composition...']);

        try {
            const textParts = [`As an expert art director, analyze the provided images. Create a single, detailed, and vivid prompt for an AI image generator.`];
            if (blendFaceRefImage) textParts.push(`The first image is a face reference; this person must be prominently featured in the final image.`);
            textParts.push(`The other images provide the scene, subjects, and style elements. Specific instructions for each image are as follows:`);
            
            validImages.forEach((img, index) => {
                let instructionText = `Image ${index + 1}`;
                const {transform, instruction} = img;
                if (transform.scale !== 1 || transform.x !== 0 || transform.y !== 0) {
                    instructionText += ` (framed with a ${transform.scale.toFixed(1)}x zoom, positioned at x:${transform.x.toFixed(0)}, y:${transform.y.toFixed(0)})`;
                }
                if (instruction) {
                    instructionText += `: "${instruction}"`;
                }
                textParts.push(instructionText);
            });

            textParts.push(`Creatively combine all these elements, interpreted through the artistic lens of '${blendMode}'.`);
            if (technicalBlendMode !== 'Normal') {
                textParts.push(`Apply a '${technicalBlendMode}' technical blend effect to harmonize the images.`);
            }
            if (prompt) textParts.push(`Weave in the user's specific guidance: '${prompt}'.`);
            textParts.push(`Your response must be ONLY the resulting creative prompt, ready to be used by an image generation model. Do not include any other text, conversation, or explanations.`);

            const imageInputs = [];
            if (blendFaceRefImage) imageInputs.push(blendFaceRefImage);
            imageInputs.push(...validImages.map(img => img.src as string));
            
            const imageParts = imageInputs.map(img => ({ inlineData: { mimeType: img.split(';')[0].split(':')[1], data: img.split(',')[1] } }));
            
            setLoadingMessage('Composing creative brief...');
            const visionResponse: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [...imageParts, { text: textParts.join(' ') }] },
            });
            
            const descriptivePrompt = visionResponse.text;
            if (!descriptivePrompt) {
                throw new Error('Could not generate a descriptive prompt from the source images.');
            }
            
            setLoadingMessage(`Generating ${numberOfImages} image(s)...`);
            const imageResponse = await ai.models.generateImages({
                model: selectedModel,
                prompt: descriptivePrompt,
                config: {
                    numberOfImages: numberOfImages,
                    outputMimeType: 'image/jpeg',
                    aspectRatio: aspectRatio as "1:1" | "3:4" | "4:3" | "9:16" | "16:9",
                },
            });
            
            const newImages = imageResponse.generatedImages.map(img => `data:image/jpeg;base64,${img.image.imageBytes}`);

            if (newImages.length > 0) {
                setGeneratedImages(newImages);
                setGeneratedImage(newImages[0]);
                playSound('finish');
            } else {
                throw new Error('Image generation succeeded, but the model did not return any images. This could be due to safety filters. Please try modifying your prompt or input images.');
            }

        } catch (err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during image generation.');
        } finally {
            stopLoadingAnimation();
        }
    };

    const handleStyleTransferGenerate = async () => {
        if (!styleContentImage || !styleStyleImage) {
            setError('Please upload a content image and a style image.');
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Analyzing artistic signatures...', 'Transmuting aesthetics...', 'Reimagining canvas...', 'Fusing style and substance...']);

        try {
            const fullPrompt = `You are a master of artistic style transfer. Your task is to apply the visual style of the second image (the style reference) to the first image (the content). The result should retain the core subject and composition of the content image, but be completely reimagined in the artistic style of the reference image. The desired strength of the style transfer is ${styleStrength}%. ${stylePrompt ? `Additional guidance: '${stylePrompt}'` : ''}`;

            const contentImagePart = { inlineData: { mimeType: styleContentImage.split(';')[0].split(':')[1], data: styleContentImage.split(',')[1] } };
            const styleImagePart = { inlineData: { mimeType: styleStyleImage.split(';')[0].split(':')[1], data: styleStyleImage.split(',')[1] } };

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [contentImagePart, styleImagePart, { text: fullPrompt }] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
                setGeneratedImage(newImage);
                setGeneratedImages([newImage]);
                playSound('finish');
            } else {
                throw getNoImageError(response);
            }
        } catch(err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during style transfer.');
        } finally {
            stopLoadingAnimation();
        }
    };

    const handleVideoGenerate = async (job: VideoQueueItem) => {
        setLoading(true);
        const loadingMessages = ["Initializing neural link...", "Compiling data streams...", "Activating render core...", "This might take a moment...", "Assembling reality matrix...", "Finalizing quantum state...", "Almost there..."];
        startLoadingAnimation(loadingMessages, 8000);
    
        try {
            let finalPrompt = job.videoPrompt;

            if (job.videoStyleImage) {
                setLoadingMessage('Analyzing style image...');
                const styleImagePart = { inlineData: { mimeType: job.videoStyleImage.split(';')[0].split(':')[1], data: job.videoStyleImage.split(',')[1] } };
                const styleDescriptionPrompt = "Describe the artistic style of this image in detail. Focus on color palette, lighting, texture, mood, and genre (e.g., 'impressionistic', 'cyberpunk', 'watercolor').";
                
                const styleResponse = await ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: { parts: [styleImagePart, {text: styleDescriptionPrompt}] },
                });
                
                const styleDescription = styleResponse.text.trim();
                if (styleDescription) {
                    finalPrompt = `Render this video in the following artistic style: "${styleDescription}". The scene is: ${finalPrompt}`;
                }
            }

            if (job.videoBlendMode) {
                finalPrompt = `In the artistic mood of '${job.videoBlendMode}', create a video of: ${finalPrompt}`;
            }
            if (job.videoFaceRefImage) {
                finalPrompt += `. The main character should look like the person in the provided reference image.`;
            }
            if (job.videoDialogue) {
                finalPrompt += ` A character in the scene is speaking and their lip movements should match this dialogue: "${job.videoDialogue}"`;
            }
            
            const generateVideosParams: {model: string, prompt: string, image?: {imageBytes: string, mimeType: string}, config: any} = {
                model: 'veo-2.0-generate-001',
                prompt: finalPrompt,
                config: { numberOfVideos: 1 }
            };

            const validVideoImages = job.videoImages.filter(img => img) as string[];
            const primaryImage = job.videoFaceRefImage || validVideoImages[0];
    
            if (primaryImage) {
                generateVideosParams.image = {
                    imageBytes: primaryImage.split(',')[1],
                    mimeType: primaryImage.split(';')[0].split(':')[1],
                };
            }
            
            setLoadingMessage('Sending request to video core...');
            let operation = await ai.models.generateVideos(generateVideosParams);
    
            while (!operation.done) {
                await new Promise(resolve => setTimeout(resolve, 10000));
                operation = await ai.operations.getVideosOperation({ operation: operation });
            }
    
            if (loadingIntervalRef.current) clearInterval(loadingIntervalRef.current);
    
            if (operation.error) {
                throw new Error(`Video generation failed with an error: ${operation.error.message} (Code: ${operation.error.code})`);
            }

            const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
            if (!downloadLink) {
                throw new Error('Video generation completed, but no video was returned. This may be due to safety filters or an issue with the prompt/images. Please try adjusting your inputs.');
            }
    
            setLoadingMessage('Downloading generated video...');
            
            const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
            if (!videoResponse.ok) throw new Error(`Failed to download video: ${videoResponse.statusText}`);
            
            const videoBlob = await videoResponse.blob();
            const videoUrl = URL.createObjectURL(videoBlob);
            setGeneratedVideoUrl(videoUrl);
            playSound('finish');

            // If this was the last job, generate metadata for the main result panel
            if (videoQueue.length === 1) {
                await handleGenerateVideoMetadata();
            }
    
            // Dequeue and release the lock for the next job
            setVideoQueue(prev => prev.slice(1));
            setCurrentlyProcessingVideoId(null);

            // Stop the main loading animation if the queue is now empty
            if (videoQueue.length === 1) {
                stopLoadingAnimation();
            }

        } catch (err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during video generation.');
            // On error, halt and clear the queue
            setVideoQueue([]);
            setCurrentlyProcessingVideoId(null);
            stopLoadingAnimation();
        }
    };

    const handleAudioGenerate = async () => {
        if (!audioPrompt) {
            setError('Please enter a prompt to generate audio.');
            return;
        }
        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Initializing audio core...', 'Synthesizing sound waves...', 'Rendering final waveform...']);
        
        await new Promise(resolve => setTimeout(resolve, 4000));

        playSound('error');
        setError('Audio generation feature is currently under development and not yet available.');
        stopLoadingAnimation();
    };

    const handleAddToQueue = () => {
        if (!isVideoFormComplete) return;
        const newJob: VideoQueueItem = {
            id: `vid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            videoPrompt,
            videoImages,
            videoFaceRefImage,
            videoStyleImage,
            videoBlendMode,
            videoDialogue,
        };
        setVideoQueue(prevQueue => [...prevQueue, newJob]);
        setError(null);
        setGeneratedVideoUrl(null);
        setGeneratedImageMetadata(null);
    };

    useEffect(() => {
        if (!currentlyProcessingVideoId && videoQueue.length > 0) {
            const nextJob = videoQueue[0];
            setCurrentlyProcessingVideoId(nextJob.id);
            handleVideoGenerate(nextJob);
        }
    }, [videoQueue, currentlyProcessingVideoId]);

    const handleGenerate = async () => {
        playSound('start');
        switch (activeTab) {
            case 'blend':
                await handleBlendGenerate();
                break;
            case 'swap':
                await handleFaceSwapGenerate();
                break;
            case 'inpaint':
                await handleInpaintGenerate();
                break;
            case 'video':
                handleAddToQueue();
                break;
            case 'style':
                await handleStyleTransferGenerate();
                break;
            case 'audio':
                await handleAudioGenerate();
                break;
            case 'genesis':
                await handleGenesisGenerate();
                break;
        }
    };

    const handleGenesisGenerate = async () => {
        const mandelbrotCanvas = mandelbrotCanvasRef.current;
        const compositionCanvas = compositionCanvasRef.current;

        if (!mandelbrotCanvas || !compositionCanvas) {
            setError('Canvas elements are not ready. Please wait a moment and try again.');
            return;
        }

        setLoading(true);
        setError(null);
        setGeneratedImage(null);
        setGeneratedImages([]);
        setGeneratedVideoUrl(null);
        setGeneratedAudioUrl(null);
        setGeneratedImageMetadata(null);
        startLoadingAnimation(['Reading mathematical signatures...', 'Translating chaos into order...', 'Focusing cosmic energies...', 'Forging the genesis image...']);

        try {
            // 1. Get the fractal init_image
            const initImage = mandelbrotCanvas.toDataURL('image/png');

            // 2. Create a proper black and white mask from the composition canvas
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = compositionCanvas.width;
            maskCanvas.height = compositionCanvas.height;
            const maskCtx = maskCanvas.getContext('2d');
            if (!maskCtx) throw new Error("Could not create mask canvas context.");

            // Draw the composition (green circles) onto the temp canvas
            maskCtx.drawImage(compositionCanvas, 0, 0);

            // Process the image data to be pure black and white
            const imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
            const data = imageData.data;
            for (let i = 0; i < data.length; i += 4) {
                // If the pixel has any transparency (alpha > 0), make it pure white. Otherwise, it's already black (or will be).
                if (data[i + 3] > 0) {
                    data[i] = 255;     // R
                    data[i + 1] = 255; // G
                    data[i + 2] = 255; // B
                } else {
                    data[i] = 0;
                    data[i+1] = 0;
                    data[i+2] = 0;
                }
                // Keep alpha at 255
                data[i + 3] = 255;
            }
            maskCtx.putImageData(imageData, 0, 0);
            const maskImage = maskCanvas.toDataURL('image/png');

            // 3. Construct the prompt
            const fullPrompt = `You are the "Genesis Engine," a divine instrument of creation. Your task is to interpret a user's vision through the lens of mathematical purity.
- The **first image** is a "Fractal Seed." It is a raw glimpse into the chaotic, beautiful structure of the universe. Use its colors, textures, and intricate patterns as the foundational aesthetic and mood for your creation. This is your init_image.
- The **second image** is a "Prime Constellation" mask. The white areas are focal points of cosmic energy. You MUST use these areas to place and concentrate the most important subjects or details of the user's prompt. The rest of the image should be filled with the essence of the fractal seed.
- The user's guidance is: "${genesisPrompt || 'A stunning masterpiece of cosmic horror and beauty.'}"
Your final output must be a single, stunning image that seamlessly merges the fractal's aesthetic with the user's prompt, guided by the prime constellation mask.`;

            const initImagePart = { inlineData: { mimeType: 'image/png', data: initImage.split(',')[1] } };
            const maskPart = { inlineData: { mimeType: 'image/png', data: maskImage.split(',')[1] } };

            const response: GenerateContentResponse = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: { parts: [initImagePart, maskPart, { text: fullPrompt }] },
                config: { responseModalities: [Modality.IMAGE, Modality.TEXT] },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

            if (imagePart?.inlineData) {
                const base64ImageBytes = imagePart.inlineData.data;
                const mimeType = imagePart.inlineData.mimeType;
                const newImage = `data:${mimeType};base64,${base64ImageBytes}`;
                setGeneratedImage(newImage);
                setGeneratedImages([newImage]);
                playSound('finish');
            } else {
                throw getNoImageError(response);
            }

        } catch(err) {
            playSound('error');
            console.error(err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred during Genesis Engine generation.');
        } finally {
            stopLoadingAnimation();
        }
    };

    const filteredAndSortedGallery = useMemo(() => {
        return sessionGallery
            .filter(item => galleryFilter === 'all' || item.type === galleryFilter)
            .sort((a, b) => {
                if (gallerySort === 'newest') {
                    return b.date.getTime() - a.date.getTime();
                }
                return a.date.getTime() - b.date.getTime();
            });
    }, [sessionGallery, galleryFilter, gallerySort]);
    
    const isBlendFormComplete = blendImages.filter(img => img.src).length >= 2 && blendMode;
    const isFaceSwapFormComplete = sourceImage && faceRefImage;
    const isInpaintFormComplete = inpaintImage && inpaintMask && inpaintPrompt;
    const isVideoFormComplete = videoPrompt || videoImages.some(img => img);
    const isStyleTransferFormComplete = styleContentImage && styleStyleImage;
    const isAudioFormComplete = !!audioPrompt;
    const isGenesisFormComplete = true; // Placeholder

    const baseButton: React.CSSProperties = { fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.3s ease', padding: '0.75rem 1.5rem', fontSize: '1rem', fontWeight: 700, borderRadius: '0px' };

    const styles: { [key: string]: React.CSSProperties } = {
        main: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '2rem', background: 'transparent' },
        header: { textAlign: 'center', marginBottom: '1rem' },
        title: { fontFamily: "'Orbitron', sans-serif", fontSize: '4rem', textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700, transition: 'all 0.3s' },
        titlePrimary: { color: 'var(--secondary-color)', textShadow: '0 0 5px var(--secondary-color), 0 0 10px var(--secondary-color), 0 0 20px var(--secondary-color)' },
        titleSecondary: { color: 'var(--primary-color)', textShadow: '0 0 5px var(--primary-color), 0 0 10px var(--primary-color)' },
        subtitle: { color: 'var(--primary-color)', textShadow: '0 0 5px var(--primary-color)', marginTop: '0.5rem', fontFamily: "'Orbitron', sans-serif", textTransform: 'uppercase' },
        container: { gap: '2rem', width: '100%', maxWidth: '1400px' },
        controls: { background: 'rgba(10, 10, 10, 0.8)', padding: '2rem', borderRadius: '0px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1.5rem', backdropFilter: 'blur(5px)', boxShadow: 'inset 0 0 10px rgba(57, 255, 20, 0.3), 0 0 15px rgba(57, 255, 20, 0.3)' },
        tabsContainer: { display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem', flexWrap: 'wrap' },
        tabButton: { padding: '0.75rem 1.5rem', background: 'none', border: 'none', color: 'var(--on-surface-color)', cursor: 'pointer', fontSize: '1rem', fontWeight: 700, borderBottom: '3px solid transparent', transition: 'all 0.3s ease' },
        tabButtonActive: { color: 'var(--primary-color)', borderBottom: '3px solid var(--primary-color)', textShadow: '0 0 8px var(--primary-color)' },
        imageUploads: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: '1rem' },
        uploadBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(57, 255, 20, 0.5)', borderRadius: '0px', aspectRatio: '1 / 1', textAlign: 'center', cursor: 'pointer', position: 'relative', overflow: 'hidden', transition: 'all 0.3s ease', background: 'rgba(0,0,0,0.2)' },
        uploadBoxHover: { borderColor: 'var(--primary-color)', backgroundColor: 'rgba(57, 255, 20, 0.1)' },
        uploadIcon: { fontSize: '2rem', color: 'var(--on-surface-color)' },
        uploadText: { fontSize: '0.9rem', color: 'var(--on-surface-color)', marginTop: '0.5rem' },
        imagePreview: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', top: 0, left: 0, pointerEvents: 'none' },
        removeButton: { position: 'absolute', top: '5px', right: '5px', background: 'rgba(0,0,0,0.8)', color: 'white', border: '1px solid var(--primary-color)', borderRadius: '0px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', zIndex: 10, transition: 'transform 0.2s' },
        addImageButton: { display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px dashed rgba(57, 255, 20, 0.5)', borderRadius: '0px', background: 'transparent', color: 'var(--on-surface-color)', fontSize: '3rem', cursor: 'pointer', transition: 'all 0.3s ease', aspectRatio: '1 / 1' },
        sectionTitle: { fontSize: '1.2rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem', marginBottom: '0.5rem', color: 'var(--primary-color)', textShadow: '0 0 4px var(--primary-color)' },
        blendModes: { display: 'flex', flexWrap: 'wrap', gap: '0.75rem' },
        blendCard: { padding: '1rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--on-surface-color)', borderRadius: '0px', cursor: 'pointer', transition: 'all 0.3s ease', flexGrow: 1, flexBasis: 'calc(50% - 0.5rem)', textAlign: 'left' },
        blendCardSelected: { borderColor: 'var(--secondary-color)', boxShadow: '0 0 10px var(--secondary-color)', background: 'rgba(255, 0, 255, 0.1)' },
        blendCardTitle: { fontWeight: 'bold', marginBottom: '0.25rem', color: 'var(--secondary-color)' },
        blendCardDescription: { fontSize: '0.85rem', color: 'var(--on-surface-color)', lineHeight: 1.4, fontFamily: "'Roboto', sans-serif", textTransform: 'none' },
        aspectRatioSelector: { display: 'flex', gap: '0.75rem', flexWrap: 'wrap' },
        aspectRatioButton: { ...baseButton, padding: '0.5rem 1rem', border: '1px solid var(--border-color)', background: 'transparent', color: 'var(--on-surface-color)' },
        aspectRatioButtonSelected: { borderColor: 'var(--primary-color)', color: 'var(--primary-color)', background: 'rgba(57, 255, 20, 0.1)', animation: 'pulse-selected 2s infinite ease-in-out' },
        promptInput: { width: '100%', minHeight: '80px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '0px', padding: '0.75rem', color: 'var(--on-surface-color)', fontSize: '1rem', resize: 'vertical', fontFamily: "'Roboto', sans-serif" },
        promptContainer: { position: 'relative', display: 'flex', alignItems: 'center' },
        enhancerButton: { position: 'absolute', right: '10px', top: '10px', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', color: 'var(--primary-color)', width: '32px', height: '32px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, transition: 'all 0.2s' },
        miniSpinner: { width: '16px', height: '16px', border: '2px solid rgba(57, 255, 20, 0.3)', borderTopColor: 'var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' },
        selectInput: { width: '100%', background: 'rgba(0,0,0,0.5)', border: '1px solid var(--border-color)', borderRadius: '0px', padding: '0.75rem', color: 'var(--on-surface-color)', fontSize: '1rem' },
        actionButtonsContainer: { display: 'flex', gap: '1rem', marginTop: 'auto' },
        resetButton: { ...baseButton, flexGrow: 0, padding: '1rem', fontSize: '1.2rem', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', boxShadow: '0 0 8px rgba(57, 255, 20, 0.5)' },
        generateButton: { ...baseButton, flexGrow: 1, padding: '1rem', fontSize: '1.2rem', background: 'var(--primary-color)', color: '#000', border: 'none', boxShadow: '0 0 8px var(--primary-color), inset 0 0 5px rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' },
        generateButtonDisabled: { opacity: 0.5, cursor: 'not-allowed', boxShadow: 'none' },
        result: { background: 'rgba(10, 10, 10, 0.8)', padding: '2rem', borderRadius: '0px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px', position: 'relative', backdropFilter: 'blur(5px)', boxShadow: 'inset 0 0 10px rgba(57, 255, 20, 0.3), 0 0 15px rgba(57, 255, 20, 0.3)' },
        resultActions: { display: 'flex', gap: '1rem', marginTop: '1.5rem', flexWrap: 'wrap', justifyContent: 'center' },
        generatedImageContainer: { width: '100%', position: 'relative', borderRadius: '0px', overflow: 'hidden', background: '#000' },
        generatedImage: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'contain' },
        resultThumbnailsContainer: { display: 'flex', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap', justifyContent: 'center' },
        resultThumbnail: { width: '80px', height: '80px', objectFit: 'cover', borderRadius: '0px', cursor: 'pointer', border: '2px solid var(--border-color)', transition: 'all 0.2s ease' },
        resultThumbnailSelected: { borderColor: 'var(--secondary-color)', transform: 'scale(1.1)', boxShadow: '0 0 10px var(--secondary-color)' },
        placeholder: { textAlign: 'center', color: 'var(--on-surface-color)' },
        spinnerContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.5rem' },
        futuristicSpinner: { width: '60px', height: '60px', position: 'relative' },
        errorContainer: { border: '2px solid var(--error-color)', padding: '1rem', borderRadius: '0px', background: 'rgba(255, 65, 65, 0.1)', textAlign: 'left', width: '100%' },
        errorTitle: { color: 'var(--error-color)', textShadow: '0 0 5px var(--error-color)', marginBottom: '0.5rem', textAlign: 'center' },
        errorMessage: { color: 'var(--on-surface-color)', marginBottom: '1rem', fontFamily: "'Roboto', sans-serif", textTransform: 'none', whiteSpace: 'pre-wrap', wordBreak: 'break-word' },
        actionButton: { ...baseButton, textDecoration: 'none', textAlign: 'center' },
        primaryActionButton: { background: 'var(--primary-color)', color: '#000', border: '1px solid var(--primary-color)', boxShadow: '0 0 8px var(--primary-color)' },
        secondaryActionButton: { background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', boxShadow: '0 0 8px rgba(57, 255, 20, 0.5)' },
        sessionGallery: { width: '100%', maxWidth: '1400px', background: 'rgba(10, 10, 10, 0.8)', padding: '1.5rem 2rem', borderRadius: '0px', border: '1px solid var(--border-color)', backdropFilter: 'blur(5px)', boxShadow: 'inset 0 0 10px rgba(57, 255, 20, 0.3), 0 0 15px rgba(57, 255, 20, 0.3)' },
        galleryContainer: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '1rem', padding: '1rem 0' },
        galleryThumbnail: { position: 'relative', width: '100%', paddingBottom: '100%', borderRadius: '0px', overflow: 'hidden', cursor: 'pointer', border: '2px solid var(--border-color)', transition: 'all 0.3s ease', background: '#000', animation: 'fadeInGalleryItem 0.5s ease-out' },
        galleryThumbnailImg: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' },
        galleryTooltip: { position: 'absolute', bottom: '110%', left: '50%', transform: 'translateX(-50%)', background: 'rgba(0,0,0,0.9)', color: 'white', padding: '0.75rem', borderRadius: '4px', fontSize: '0.8rem', whiteSpace: 'normal', width: 'max-content', maxWidth: '180px', textAlign: 'center', zIndex: 20, pointerEvents: 'none', opacity: 0, transition: 'opacity 0.2s' },
        galleryEditButton: { position: 'absolute', top: '5px', left: '5px', background: 'rgba(0,0,0,0.7)', color: 'white', border: '1px solid var(--primary-color)', borderRadius: '0px', width: '24px', height: '24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, transition: 'transform 0.2s', fontSize: '0.7rem' },
        maskingContainer: { position: 'relative', width: '100%', maxWidth: '400px', margin: '0 auto', cursor: 'none' },
        maskingCanvas: { position: 'absolute', top: 0, left: 0, cursor: 'none', touchAction: 'none' },
        maskControls: { display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' },
        sliderContainer: { display: 'flex', alignItems: 'center', gap: '1rem' },
        slider: { flexGrow: 1 },
        galleryFilterContainer: { display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' },
    };
    
    const styleSheet = `
      @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      @keyframes pulse { 0% { box-shadow: 0 0 0 0 var(--primary-color); } 70% { box-shadow: 0 0 10px 15px transparent; } 100% { box-shadow: 0 0 0 0 transparent; } }
      @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes scanlines { from { background-position: 0 0; } to { background-position: 0 100px; } }
      @keyframes pulse-selected { 0%, 100% { box-shadow: 0 0 8px var(--primary-color); } 50% { box-shadow: 0 0 15px var(--primary-color), 0 0 5px var(--primary-color) inset; } }
      @keyframes fadeInGalleryItem { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
      @keyframes glitch {
        0% { transform: translate(0); text-shadow: 0 0 5px var(--primary-color), 0 0 10px var(--secondary-color); }
        20% { transform: translate(-3px, 3px); }
        40% { transform: translate(2px, -2px); }
        60% { transform: translate(-1px, 2px); text-shadow: 0 0 20px var(--primary-color), 0 0 30px var(--secondary-color); }
        80% { transform: translate(1px, -1px); }
        100% { transform: translate(0); text-shadow: 0 0 5px var(--primary-color), 0 0 10px var(--secondary-color); }
      }
      
      .futuristic-spinner div {
        box-sizing: border-box;
        position: absolute;
        width: 100%;
        height: 100%;
        border: 4px solid transparent;
        border-top-color: var(--primary-color);
        border-radius: 50%;
        animation: spin 1.5s cubic-bezier(0.6, 0.2, 0.4, 0.8) infinite;
        box-shadow: 0 0 10px var(--primary-color);
      }
      .futuristic-spinner div:nth-child(1) { animation-delay: -0.45s; border-color: transparent; border-top-color: var(--secondary-color); box-shadow: 0 0 10px var(--secondary-color); }
      .futuristic-spinner div:nth-child(2) { animation-delay: -0.3s; transform: scale(0.8); }
      .futuristic-spinner div:nth-child(3) { animation-delay: -0.15s; border-color: transparent; border-top-color: var(--primary-color); transform: scale(0.6); }

      .main-content-container { 
        display: grid;
        grid-template-columns: 450px 1fr;
      }
      @media (max-width: 1024px) { 
        .main-content-container { 
            grid-template-columns: 1fr; 
        } 
      }
      
      .tab-content { animation: fadeIn 0.5s ease; }
      .gallery-thumbnail:hover .gallery-tooltip { opacity: 1; }
      
      button:hover:not(:disabled), a.action-button:hover, .addImageButton:hover, .enhancer-button:hover:not(:disabled) {
        box-shadow: 0 0 15px rgba(57, 255, 20, 0.8) !important;
        transform: translateY(-2px);
      }
      button.primary-action-button:hover, a.primary-action-button:hover, .generate-button:hover:not(:disabled) {
        box-shadow: 0 0 25px var(--primary-color) !important;
      }
      .blend-card:hover, .aspect-ratio-button:hover, .gallery-thumbnail:hover { transform: scale(1.03); border-color: var(--secondary-color); box-shadow: 0 0 10px var(--secondary-color); }
      input:focus, textarea:focus, select:focus { border-color: var(--secondary-color) !important; box-shadow: 0 0 10px var(--secondary-color) !important; outline: none !important; }
      .remove-button:hover { transform: scale(1.2); }
      button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none !important; }
      
      button:focus-visible, a:focus-visible, [role="button"]:focus-visible, .gallery-thumbnail:focus-visible {
        outline: 2px solid var(--secondary-color);
        outline-offset: 2px;
        box-shadow: 0 0 12px var(--secondary-color) !important;
      }
      
      .result-loading::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(0deg, transparent 0%, rgba(0, 255, 0, 0.05) 50%, transparent 100%);
        background-size: 100% 4px;
        animation: scanlines 2s linear infinite;
        pointer-events: none;
        z-index: 10;
      }
      .title-glitch {
        animation: glitch 0.4s infinite;
      }
    `;

    const getAspectRatioPadding = (ratio: string) => {
        if (!ratio || ratio === 'N/A') return '100%';
        const [width, height] = ratio.split(':').map(Number);
        if (isNaN(width) || isNaN(height) || width === 0) return '100%';
        return `${(height / width) * 100}%`;
    };

    const shouldShowVideoQueue = activeTab === 'video' && videoQueue.length > 0;


    return (
        <main style={styles.main}>
            <style>{styleSheet}</style>
            <header style={styles.header}>
                <h1 style={styles.title} className={loading ? 'title-glitch' : ''}>
                    <span style={styles.titlePrimary}>Bando-Fi</span>
                    <span style={styles.titleSecondary}> AI</span>
                </h1>
                <p style={styles.subtitle}>Creative Revolution</p>
            </header>

            <div className="main-content-container" style={styles.container}>
                <div style={styles.controls}>
                    <div style={styles.tabsContainer}>
                        <button style={{...styles.tabButton, ...(activeTab === 'blend' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('blend')}>Image Blending</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'swap' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('swap')}>Face Swap</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'inpaint' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('inpaint')}>Inpainting</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'style' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('style')}>Style Transfer</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'video' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('video')}>Video Gen</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'audio' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('audio')}>Audio Gen</button>
                        <button style={{...styles.tabButton, ...(activeTab === 'genesis' ? styles.tabButtonActive : {})}} onClick={() => setActiveTab('genesis')}>Genesis Engine</button>
                    </div>

                    <div key={activeTab} className="tab-content">
                       {activeTab === 'blend' && <BlendControls {...{styles, blendImages, handleBlendImageUpload, handleRemoveBlendImage, handleBlendImageTransformChange, handleAddBlendImageSlot, blendFaceRefImage, setBlendFaceRefImage, blendMode, setBlendMode, BLEND_MODES, technicalBlendMode, setTechnicalBlendMode, TECHNICAL_BLEND_MODES, prompt, setPrompt, handleEnhancePrompt, isEnhancing, selectedModel, setSelectedModel, GENERATION_MODELS, aspectRatio, setAspectRatio, ASPECT_RATIOS, numberOfImages, setNumberOfImages, handleBlendImageInstructionChange}} />}
                       {activeTab === 'swap' && <FaceSwapControls {...{styles, faceRefImage, setFaceRefImage, handleFaceRefUpload, sourceImage, handleSourceImageUpload, setSourceImage, brushSize, setBrushSize, brushShape, setBrushShape, setMask, faceFidelity, setFaceFidelity, colorMatching, setColorMatching, faceSwapPrompt, setFaceSwapPrompt, handleEnhancePrompt, isEnhancing}} />}
                       {activeTab === 'inpaint' && <InpaintingControls {...{styles, inpaintImage, handleInpaintImageUpload, setInpaintImage, brushSize, setBrushSize, brushShape, setBrushShape, setInpaintMask, inpaintPrompt, setInpaintPrompt, handleEnhancePrompt, isEnhancing, inpaintCreativity, setInpaintCreativity}} />}
                       {activeTab === 'video' && <VideoControls {...{styles, videoImages, handleVideoImageUpload, handleRemoveVideoImage, handleAddVideoImageSlot, videoFaceRefImage, setVideoFaceRefImage, videoStyleImage, setVideoStyleImage, videoBlendMode, setVideoBlendMode, BLEND_MODES, videoPrompt, setVideoPrompt, handleEnhancePrompt, isEnhancing, videoDialogue, setVideoDialogue}} />}
                       {activeTab === 'style' && <StyleTransferControls {...{styles, styleContentImage, handleStyleImageUpload, setStyleContentImage, styleStyleImage, setStyleStyleImage, styleStrength, setStyleStrength, stylePrompt, setStylePrompt, handleEnhancePrompt, isEnhancing}} />}
                       {activeTab === 'audio' && <AudioControls {...{styles, audioPrompt, setAudioPrompt, handleEnhancePrompt, isEnhancing, voiceType, setVoiceType, VOICE_TYPES}} />}
                       {activeTab === 'genesis' && <GenesisEngineControls ref={{ mandelbrotRef: mandelbrotCanvasRef, compositionRef: compositionCanvasRef }} {...{styles, genesisPrompt, setGenesisPrompt, handleEnhancePrompt, isEnhancing, useGoldenRatio, setUseGoldenRatio}} />}
                    </div>

                    <div style={styles.actionButtonsContainer}>
                         <button style={styles.resetButton} className="action-button" onClick={handleReset}>Reset</button>
                         <button 
                            style={{
                                ...styles.generateButton, 
                                ...(( (activeTab !== 'video' && loading) ||
                                    (activeTab === 'blend' && !isBlendFormComplete) || 
                                    (activeTab === 'swap' && !isFaceSwapFormComplete) ||
                                    (activeTab === 'inpaint' && !isInpaintFormComplete) ||
                                    (activeTab === 'video' && !isVideoFormComplete) ||
                                    (activeTab === 'style' && !isStyleTransferFormComplete) ||
                                    (activeTab === 'audio' && !isAudioFormComplete) ||
                                    (activeTab === 'genesis' && !isGenesisFormComplete)
                                ) ? styles.generateButtonDisabled : {})
                            }}
                            className="generate-button"
                            onClick={handleGenerate} 
                            disabled={
                                (activeTab !== 'video' && loading) ||
                                (activeTab === 'blend' && !isBlendFormComplete) || 
                                (activeTab === 'swap' && !isFaceSwapFormComplete) ||
                                (activeTab === 'inpaint' && !isInpaintFormComplete) ||
                                (activeTab === 'video' && !isVideoFormComplete) ||
                                (activeTab === 'style' && !isStyleTransferFormComplete) ||
                                (activeTab === 'audio' && !isAudioFormComplete) ||
                                (activeTab === 'genesis' && !isGenesisFormComplete)
                            }
                         >
                            {loading && activeTab !== 'video' && <div style={{...styles.miniSpinner, width: '20px', height: '20px', borderTopColor: '#000'}}></div>}
                            {activeTab === 'video' ? 'Add to Queue' : 'Generate'}
                        </button>
                    </div>
                </div>

                <div style={styles.result} className={loading ? 'result-loading' : ''}>
                    {shouldShowVideoQueue ? (
                        <div style={{width: '100%', textAlign: 'center', animation: 'fadeIn 0.5s'}}>
                            <h3 style={{...styles.sectionTitle, border: 'none', marginBottom: '1.5rem'}}>Video Generation Queue</h3>
                            {currentlyProcessingVideoId && videoQueue.length > 0 && (
                                <div style={{animation: 'fadeIn 0.5s ease'}}>
                                    <p style={{color: 'var(--primary-color)'}}><strong>Now Processing (Job {videoQueue.length} remaining)</strong></p>
                                    <p style={{fontStyle: 'italic', color: 'var(--on-surface-color)', margin: '0.25rem 0 1rem', padding: '0 1rem'}}>"{videoQueue[0].videoPrompt.substring(0, 80)}..."</p>
                                    <div style={styles.spinnerContainer}>
                                         <div style={styles.futuristicSpinner} className="futuristic-spinner">
                                             <div></div><div></div><div></div>
                                         </div>
                                         <p style={{marginTop: '1rem', textTransform: 'uppercase'}}>{loadingMessage}</p>
                                     </div>
                                </div>
                            )}
                            {videoQueue.length > 1 && (
                                 <div style={{textAlign: 'left', marginTop: '2rem', width: '100%', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem'}}>
                                     <h4 style={{textAlign: 'center', marginBottom: '1rem', color: 'var(--secondary-color)'}}>Up Next</h4>
                                     <ul style={{listStyle: 'none', padding: '0.5rem', margin: 0, maxHeight: '150px', overflowY: 'auto'}}>
                                        {videoQueue.slice(1).map((job, index) => (
                                            <li key={job.id} style={{padding: '0.5rem', background: 'rgba(0,0,0,0.2)', marginBottom: '0.5rem', borderRadius: '0px', fontSize: '0.9rem'}}>
                                                <strong>#{index + 2}:</strong> "{job.videoPrompt.substring(0, 40)}..." 
                                                <span style={{color: 'var(--primary-color)', marginLeft: '0.5rem', display: 'block', fontSize: '0.8rem', marginTop: '0.25rem'}}>(Estimated wait: ~{(index + 1) * 5} minutes)</span>
                                            </li>
                                        ))}
                                     </ul>
                                 </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {loading && (
                                <div style={styles.spinnerContainer}>
                                    <div style={styles.futuristicSpinner} className="futuristic-spinner">
                                        <div></div>
                                        <div></div>
                                        <div></div>
                                    </div>
                                    <p style={{marginTop: '1rem', textTransform: 'uppercase'}}>{loadingMessage}</p>
                                </div>
                            )}
                            {error && !loading && (
                                <div style={styles.errorContainer}>
                                    <h3 style={styles.errorTitle}>Generation Failed</h3>
                                    <p style={styles.errorMessage}>{error}</p>
                                    <button 
                                        onClick={() => navigator.clipboard.writeText(error)} 
                                        style={{...styles.actionButton, ...styles.secondaryActionButton, borderColor: 'var(--error-color)', color: 'var(--error-color)', margin: '0 auto', display: 'block' }}>
                                        Copy Details
                                    </button>
                                </div>
                            )}
                            {!loading && !error && generatedImage && (
                                <>
                                  <div style={{...styles.generatedImageContainer, paddingTop: getAspectRatioPadding(activeTab === 'blend' ? aspectRatio : '1:1')}}>
                                      <img src={generatedImage} alt="Generated result" style={styles.generatedImage}/>
                                  </div>
                                   {generatedImages.length > 1 && (
                                    <div style={styles.resultThumbnailsContainer}>
                                        {generatedImages.map((img, index) => (
                                            <img 
                                                key={index} 
                                                src={img} 
                                                alt={`Result ${index + 1}`}
                                                style={{...styles.resultThumbnail, ...(img === generatedImage ? styles.resultThumbnailSelected : {})}}
                                                onClick={() => {
                                                    setGeneratedImage(img);
                                                    setGeneratedImageMetadata(null);
                                                }}
                                            />
                                        ))}
                                    </div>
                                   )}
                                   {generatedImageMetadata ? (
                                        <div style={{textAlign: 'center', margin: '1rem 0', animation: 'fadeIn 0.5s ease'}}>
                                            <p><strong>Name:</strong> {generatedImageMetadata.name}</p>
                                            <p><strong>Tags:</strong> {generatedImageMetadata.tags.join(', ')}</p>
                                        </div>
                                    ) : (
                                        <p style={{textAlign: 'center', margin: '1rem 0', color: 'var(--on-surface-color)', fontStyle: 'italic'}}>
                                            Generate metadata to name and save your creation.
                                        </p>
                                    )}
                                  <div style={styles.resultActions}>
                                    {!generatedImageMetadata && (
                                        <button onClick={handleGenerateMetadata} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={isMetadataLoading}>
                                            {isMetadataLoading ? 'Analyzing...' : 'Generate Metadata'}
                                        </button>
                                    )}
                                    <button onClick={handleSaveToSession} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={!generatedImageMetadata}> Save to Session </button>
                                    <button onClick={() => handleAddToVideoGen(generatedImage)} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button"> Add to Video Gen </button>
                                    <a href={generatedImage} download={`${generatedImageMetadata?.name || 'generated-image'}.jpg`} style={{...styles.actionButton, ...styles.primaryActionButton}} className="action-button primary-action-button"> Download Image </a>
                                  </div>
                                </>
                            )}
                            {!loading && !error && generatedVideoUrl && (
                                <>
                                    <div style={{...styles.generatedImageContainer, paddingTop: getAspectRatioPadding('16:9'), backgroundColor: '#000'}}>
                                        <video 
                                            src={generatedVideoUrl} 
                                            controls 
                                            autoPlay 
                                            loop 
                                            style={{...styles.generatedImage, objectFit: 'contain'}} 
                                            aria-label="Generated video result"
                                        />
                                    </div>
                                    {generatedImageMetadata ? (
                                        <div style={{textAlign: 'center', margin: '1rem 0', animation: 'fadeIn 0.5s ease'}}>
                                            <p><strong>Name:</strong> {generatedImageMetadata.name}</p>
                                            <p><strong>Tags:</strong> {generatedImageMetadata.tags.join(', ')}</p>
                                        </div>
                                    ) : (
                                        <p style={{textAlign: 'center', margin: '1rem 0', color: 'var(--on-surface-color)', fontStyle: 'italic'}}>
                                            Generate metadata to name and save your creation.
                                        </p>
                                    )}
                                    <div style={styles.resultActions}>
                                        {!generatedImageMetadata && (
                                            <button onClick={handleGenerateVideoMetadata} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={isMetadataLoading}>
                                                {isMetadataLoading ? 'Analyzing...' : 'Generate Metadata'}
                                            </button>
                                        )}
                                        <button onClick={handleSaveToSession} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={!generatedImageMetadata}> Save to Session </button>
                                        <a href={generatedVideoUrl} download={`${generatedImageMetadata?.name || 'generated-video'}.mp4`} style={{...styles.actionButton, ...styles.primaryActionButton}} className="action-button primary-action-button"> Download Video </a>
                                    </div>
                                </>
                            )}
                             {!loading && !error && generatedAudioUrl && (
                                <>
                                    <div style={{...styles.generatedImageContainer, paddingTop: '0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '300px', background: '#050505' }}>
                                        <span style={{fontSize: '5rem', display: 'block', marginBottom: '1rem'}}>🎵</span>
                                        <audio 
                                            src={generatedAudioUrl} 
                                            controls 
                                            autoPlay
                                            style={{width: '80%'}} 
                                            aria-label="Generated audio result"
                                        />
                                    </div>
                                    {generatedImageMetadata ? (
                                        <div style={{textAlign: 'center', margin: '1rem 0', animation: 'fadeIn 0.5s ease'}}>
                                            <p><strong>Name:</strong> {generatedImageMetadata.name}</p>
                                            <p><strong>Tags:</strong> {generatedImageMetadata.tags.join(', ')}</p>
                                        </div>
                                    ) : (
                                        <p style={{textAlign: 'center', margin: '1rem 0', color: 'var(--on-surface-color)', fontStyle: 'italic'}}>
                                            Generate metadata to name and save your creation.
                                        </p>
                                    )}
                                  <div style={styles.resultActions}>
                                    {!generatedImageMetadata && (
                                        <button onClick={handleGenerateAudioMetadata} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={isMetadataLoading}>
                                            {isMetadataLoading ? 'Analyzing...' : 'Generate Metadata'}
                                        </button>
                                    )}
                                    <button onClick={handleSaveToSession} style={{...styles.actionButton, ...styles.secondaryActionButton}} className="action-button" disabled={!generatedImageMetadata}> Save to Session </button>
                                    <a href={generatedAudioUrl} download={`${generatedImageMetadata?.name || 'generated-audio'}.mp3`} style={{...styles.actionButton, ...styles.primaryActionButton}} className="action-button primary-action-button"> Download Audio </a>
                                  </div>
                                </>
                            )}
                            {!loading && !error && !generatedImage && !generatedVideoUrl && !generatedAudioUrl && (
                                <div style={styles.placeholder}>
                                    <span style={{ fontSize: '3rem' }}>🚀</span>
                                    <h3 style={{...styles.sectionTitle, border: 'none'}}>Awaiting Creation</h3>
                                    <p>Your generated media will appear here.</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {sessionGallery.length > 0 && (
                <section style={styles.sessionGallery}>
                    <div style={{...styles.galleryFilterContainer, justifyContent: 'space-between'}}>
                        <h2 style={{...styles.sectionTitle, border: 'none', marginBottom: '0'}}>Session Gallery</h2>
                        <div style={styles.galleryFilterContainer}>
                             <select value={galleryFilter} onChange={e => setGalleryFilter(e.target.value)} style={{...styles.selectInput, width: 'auto'}}>
                                <option value="all">All Types</option>
                                <option value="blend">Blends</option>
                                <option value="swap">Swaps</option>
                                <option value="inpaint">Edits</option>
                                <option value="style">Styles</option>
                                <option value="video">Videos</option>
                                <option value="audio">Audio</option>
                            </select>
                             <select value={gallerySort} onChange={e => setGallerySort(e.target.value as 'newest' | 'oldest')} style={{...styles.selectInput, width: 'auto'}}>
                                <option value="newest">Newest First</option>
                                <option value="oldest">Oldest First</option>
                            </select>
                        </div>
                    </div>
                    <div style={styles.galleryContainer}>
                        {filteredAndSortedGallery.map(item => (
                            <div key={item.src} style={styles.galleryThumbnail} className="gallery-thumbnail" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') handleLoadToInpainting(item.src) }}>
                                {item.mediaType === 'image' && <img src={item.src} alt={item.name} style={styles.galleryThumbnailImg} />}
                                {item.mediaType === 'video' && <video src={item.src} style={styles.galleryThumbnailImg} loop muted playsInline />}
                                {item.mediaType === 'audio' && <div style={{...styles.galleryThumbnailImg, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem'}}>🎵</div>}
                                <div style={styles.galleryTooltip} className="gallery-tooltip">
                                    <strong>{item.name}</strong><br/>
                                    <span style={{fontSize: '0.75rem'}}>({item.type})</span><br/>
                                    <span style={{fontSize: '0.75rem'}}>Tags: {item.tags.join(', ')}</span>
                                </div>
                                {item.mediaType === 'image' && (
                                    <button style={styles.galleryEditButton} onClick={(e) => { e.stopPropagation(); handleLoadToInpainting(item.src); }} title="Edit with Inpainting">✎</button>
                                )}
                            </div>
                        ))}
                    </div>
                </section>
            )}
            
             <footer style={{textAlign: 'center', marginTop: 'auto', paddingTop: '2rem', color: 'var(--on-surface-color)', opacity: 0.7}}>
                <button onClick={() => setSoundEnabled(!soundEnabled)} style={{background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: '1.5rem', marginBottom: '0.5rem'}}>
                    {soundEnabled ? '🔊' : '🔇'}
                </button>
                <p>Bando-Fi AI Creative Suite. All rights reserved.</p>
                <p style={{marginTop: '0.5rem'}}>Brought to you by "Massive Magnetics"</p>
            </footer>
        </main>
    );
};

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<App />);
}