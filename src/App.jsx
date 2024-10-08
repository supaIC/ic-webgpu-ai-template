///////////////////////////
import { useEffect, useState, useRef } from 'react';

import Chat from './components/Chat';
import ArrowRightIcon from './components/icons/ArrowRightIcon';
import StopIcon from './components/icons/StopIcon';
import Progress from './components/Progress';

const IS_WEBGPU_AVAILABLE = !!navigator.gpu;
const STICKY_SCROLL_THRESHOLD = 120;

function App() {

  // Create a reference to the worker object.
  const worker = useRef(null);

  const textareaRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Model loading and progress
  const [status, setStatus] = useState(null);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [progressItems, setProgressItems] = useState([]);
  const [isRunning, setIsRunning] = useState(false);

  // Inputs and outputs
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [tps, setTps] = useState(null);
  const [numTokens, setNumTokens] = useState(null);

  function onEnter(message) {
    setMessages(prev => [
      ...prev,
      { "role": "user", "content": message },
    ]);
    setTps(null);
    setIsRunning(true);
    setInput('');
  }

  useEffect(() => {
    resizeInput();
  }, [input]);

  function onInterrupt() {
    // NOTE: We do not set isRunning to false here because the worker
    // will send a 'complete' message when it is done.
    worker.current.postMessage({ type: 'interrupt' });
  }

  function resizeInput() {
    if (!textareaRef.current) return;

    const target = textareaRef.current;
    target.style.height = 'auto';
    const newHeight = Math.min(Math.max(target.scrollHeight, 24), 200);
    target.style.height = `${newHeight}px`;
  }

  // We use the `useEffect` hook to setup the worker as soon as the `App` component is mounted.
  useEffect(() => {
    if (!worker.current) {
      // Create the worker if it does not yet exist.
      worker.current = new Worker(new URL('./worker.js', import.meta.url), {
        type: 'module'
      });
    }

    // Create a callback function for messages from the worker thread.
    const onMessageReceived = (e) => {
      switch (e.data.status) {
        case 'loading':
          // Model file start load: add a new progress item to the list.
          setStatus('loading');
          setLoadingMessage(e.data.data);
          break;

        case 'initiate':
          setProgressItems(prev => [...prev, e.data]);
          break;

        case 'progress':
          // Model file progress: update one of the progress items.
          setProgressItems(
            prev => prev.map(item => {
              if (item.file === e.data.file) {
                return { ...item, ...e.data }
              }
              return item;
            })
          );
          break;

        case 'done':
          // Model file loaded: remove the progress item from the list.
          setProgressItems(
            prev => prev.filter(item => item.file !== e.data.file)
          );
          break;

        case 'ready':
          // Pipeline ready: the worker is ready to accept messages.
          setStatus('ready');
          break;

        case 'start': {
          // Start generation
          setMessages(prev => [...prev, { "role": "assistant", "content": "" }]);
        }
          break;

        case 'update': {
          // Generation update: update the output text.
          // Parse messages
          const { output, tps, numTokens } = e.data;
          setTps(tps);
          setNumTokens(numTokens)
          setMessages(prev => {
            const cloned = [...prev];
            const last = cloned.at(-1);
            cloned[cloned.length - 1] = { ...last, content: last.content + output };
            return cloned;
          });
        }
          break;

        case 'complete':
          // Generation complete: re-enable the "Generate" button
          setIsRunning(false);
          break;
      }
    };

    // Attach the callback function as an event listener.
    worker.current.addEventListener('message', onMessageReceived);

    // Define a cleanup function for when the component is unmounted.
    return () => {
      worker.current.removeEventListener('message', onMessageReceived);
    };
  }, []);

  // Send the messages to the worker thread whenever the `messages` state changes.
  useEffect(() => {
    if (messages.filter(x => x.role === 'user').length === 0) {
      // No user messages yet: do nothing.
      return;
    }
    if (messages.at(-1).role === 'assistant') {
      // Do not update if the last message is from the assistant
      return;
    }
    setTps(null);
    worker.current.postMessage({ type: 'generate', data: messages });
  }, [messages, isRunning]);

  useEffect(() => {
    if (!chatContainerRef.current) return;
    if (isRunning) {
      const element = chatContainerRef.current;
      if (element.scrollHeight - element.scrollTop - element.clientHeight < STICKY_SCROLL_THRESHOLD) {
        element.scrollTop = element.scrollHeight;
      }
    }
  }, [messages, isRunning]);

  return (
    IS_WEBGPU_AVAILABLE
      ? (<div className="flex flex-col h-screen mx-auto items justify-end text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900">

        {status === null && messages.length === 0 && (
          <div className="h-full overflow-auto scrollbar-thin flex justify-center items-center flex-col relative">
            <div className="flex flex-col items-center mb-1 max-w-[250px] text-center">
              <img src="logo.png" width="100%" height="auto" className="block"></img>
              <h1 className="text-4xl font-bold mb-1">Phi-3 WebGPU</h1>
              <h2 className="font-semibold">A private and powerful AI chatbot that runs locally in your browser.</h2>
            </div>

            <div className="flex flex-col items-center px-4">
              <p className="max-w-[514px] mb-4">
                <br />
                You are about to load <a href="https://huggingface.co/Xenova/Phi-3-mini-4k-instruct" target="_blank" rel="noreferrer" className="font-medium underline">Phi-3-mini-4k-instruct</a>,
                a 3.82 billion parameter LLM that is optimized for inference on the web. Once downloaded, the model (2.3&nbsp;GB) will be cached and reused when you revisit the page.<br />
                <br />
                Everything runs directly in your browser using <a href="https://huggingface.co/docs/transformers.js" target="_blank" rel="noreferrer" className="underline">🤗&nbsp;Transformers.js</a> and ONNX Runtime Web, meaning your conversations aren&#39;t sent to a server. You can even disconnect from the internet after the model has loaded!
              </p>

              <button
                className="border px-4 py-2 rounded-lg bg-blue-400 text-white hover:bg-blue-500 disabled:bg-blue-100 disabled:cursor-not-allowed select-none"
                onClick={() => {
                  worker.current.postMessage({ type: 'load' });
                  setStatus('loading');
                }}
                disabled={status !== null}
              >
                Load model
              </button>
            </div>
          </div>
        )}
        {status === 'loading' && (<>
          <div className="w-full max-w-[500px] text-left mx-auto p-4 bottom-0 mt-auto">
            <p className="text-center mb-1">{loadingMessage}</p>
            {progressItems.map(({ file, progress, total }, i) => (
              <Progress key={i} text={file} percentage={progress} total={total} />
            ))}
          </div>
        </>)}

        {status === 'ready' && (<div
          ref={chatContainerRef}
          className="overflow-y-auto scrollbar-thin w-full flex flex-col items-center h-full"
        >
          <Chat messages={messages} />
          <p className="text-center text-sm min-h-6 text-gray-500 dark:text-gray-300">
            {tps && messages.length > 0 && (<>
              {!isRunning &&
                <span>Generated {numTokens} tokens in {(numTokens / tps).toFixed(2)} seconds&nbsp;&#40;</span>}
              {<>
                <span className="font-medium text-center mr-1 text-black dark:text-white">
                  {tps.toFixed(2)}
                </span>
                <span className="text-gray-500 dark:text-gray-300">tokens/second</span>
              </>}
              {!isRunning && <>
                <span className="mr-1">&#41;.</span>
                <span className="underline cursor-pointer" onClick={() => {
                  worker.current.postMessage({ type: 'reset' });
                  setMessages([]);
                }}>Reset</span>
              </>}
            </>)}
          </p>
        </div>)}

        <div className="mt-2 border dark:bg-gray-700 rounded-lg w-[600px] max-w-[80%] max-h-[200px] mx-auto relative mb-3 flex">
          <textarea
            ref={textareaRef}
            className="scrollbar-thin w-[550px] dark:bg-gray-700 px-3 py-4 rounded-lg bg-transparent border-none outline-none text-gray-800 disabled:text-gray-400 dark:text-gray-200 placeholder-gray-500 dark:placeholder-gray-400 disabled:placeholder-gray-200 resize-none disabled:cursor-not-allowed"
            placeholder="Type your message..."
            type="text"
            rows={1}
            value={input}
            disabled={status !== 'ready'}
            title={status === 'ready' ? "Model is ready" : "Model not loaded yet"}
            onKeyDown={(e) => {
              if (input.length > 0 && !isRunning && (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault(); // Prevent default behavior of Enter key
                onEnter(input);
              }
            }}
            onInput={(e) => setInput(e.target.value)}
          />
          {isRunning
            ? (<div className="cursor-pointer" onClick={onInterrupt}>
              <StopIcon
                className="h-8 w-8 p-1 rounded-md text-gray-800 dark:text-gray-100 absolute right-3 bottom-3"
              />
            </div>)
            : input.length > 0
              ? (<div className="cursor-pointer" onClick={() => onEnter(input)}>
                <ArrowRightIcon
                  className={`h-8 w-8 p-1 bg-gray-800 dark:bg-gray-100 text-white dark:text-black rounded-md absolute right-3 bottom-3`}
                />
              </div>)
              : (<div>
                <ArrowRightIcon
                  className={`h-8 w-8 p-1 bg-gray-200 dark:bg-gray-600 text-gray-50 dark:text-gray-800 rounded-md absolute right-3 bottom-3`}
                />
              </div>)
          }
        </div>

        <p className="text-xs text-gray-400 text-center mb-3">
          Disclaimer: Generated content may be inaccurate or false.
        </p>
      </div>)
      : (<div className="fixed w-screen h-screen bg-black z-10 bg-opacity-[92%] text-white text-2xl font-semibold flex justify-center items-center text-center">WebGPU is not supported<br />by this browser :&#40;</div>)
  )
}

export default App












// import React, { useState, useEffect } from 'react';

// // This is a test of running larger WebGPU LLM in the browser and in an Internet Computer canister.
// // Ideally, we would consider reskinning web-llm chat, adding in awareness of files in your wallet + IC login, etc: https://github.com/mlc-ai/web-llm-chat

// // We use the Hugging Face import instead of the Xennova import.
// // Transformers.js is what we ideally want to use. Using alternatives like 'onnxruntime-web' directly can cause issues with WASM minification and other unknown issues.
// import { pipeline } from '@huggingface/transformers';

// const App = () => {
//   const [chatHistory, setChatHistory] = useState('');
//   const [pipelineInstance, setPipelineInstance] = useState(null);

//   useEffect(() => {
//     const initializePipeline = async () => {
//       try {
//         if (!pipelineInstance) {
//           // Intended to initialize the pipeline directly.
//           // We plan to use this model: https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16
//           // ISSUE: This does not work directly because we encounter the following error: 
//           // GET https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16/resolve/main/onnx/model_quantized.onnx 404 (Not Found)
//           // Instead, we should use these links: 
//           // https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16/resolve/main/onnx/model_q4.onnx 
//           // https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16/resolve/main/onnx/model_q4.onnx_data
//           // CHALLENGE: The issue is that we cannot directly set the download link using the "pipeline" function.

//           // OPTION 1: Loading Model and Data from Hugging Face URLs
//           // - Fetch model files (onnx & onnx_data) directly from Hugging Face at runtime.
//           // - This approach can face CORS issues and potential 404 errors if URLs are incorrect.

//           // OPTION 2: Upload Models to Asset Canister
//           // - Upload the models to the asset canister during deployment and load them at runtime.
//           // - Update `dfx.json` and build configuration to ensure models are packaged and deployed correctly.
//           // - Ensures models are always available and avoid runtime network issues.

//           // ALTERNATIVE OPTION: Using ONNX Runtime Directly
//           // - We could use the `onnxruntime-web` library to manually load and run the ONNX model.
//           // - This would involve fetching the ONNX model and data files manually and then running inference using `InferenceSession`.
//           // - Example:
//           //   import { InferenceSession } from 'onnxruntime-web';
//           //   const session = await InferenceSession.create('/path/to/model_q4.onnx');
//           //   const inputTensor = new onnx.Tensor('float32', inputData, [1, inputLength]);
//           //   const feeds = { input: inputTensor };
//           //   const results = await session.run(feeds);
//           // - PROS: Full control over model loading and execution.
//           // - CONS: Requires more manual setup, including handling data files and potential issues with WASM in the browser.

//           // CURRENT STATE: The code attempts to load the model directly via Hugging Face, which fails.
//           const pipe = await pipeline('text-generation', 'Xenova/Phi-3-mini-4k-instruct_fp16');
//           setPipelineInstance(pipe);
//         }
//       } catch (error) {
//         console.error('Error initializing the pipeline:', error);
//       }
//     };
//     initializePipeline();
//   }, [pipelineInstance]);

//   const sendMessage = async () => {
//     const promptInput = document.getElementById('prompt');

//     if (!promptInput) {
//       console.error('Failed to select necessary input element');
//       return;
//     }

//     const promptValue = promptInput.value;

//     try {
//       // Ensure that pipelineInstance is a function before calling it.
//       if (typeof pipelineInstance !== 'function') {
//         throw new TypeError('pipelineInstance is not a function');
//       }

//       // Generate text based on the input prompt.
//       const generatedText = await pipelineInstance(promptValue, {
//         max_length: 100, // Adjust max token length as needed.
//         temperature: 0.7, // Adjust temperature for creativity.
//       });

//       if (generatedText) {
//         // Append generated text to the chat history.
//         setChatHistory(prevHistory => 
//           prevHistory + `<p><strong>You:</strong> ${promptValue}</p><p><strong>Assistant:</strong> ${generatedText[0]?.generated_text || ''}</p>`
//         );
//         promptInput.value = '';
//       } else {
//         console.error('Failed to retrieve generated text');
//       }
//     } catch (error) {
//       console.error('Error in sendMessage():', error);
//     }
//   };

//   return (
//     <div>
//       <h1>Text Generation</h1>
//       <div id="chatHistory" dangerouslySetInnerHTML={{ __html: chatHistory }} />
//       <input type="text" id="prompt" placeholder="Enter your message" />
//       <button onClick={sendMessage}>Generate Text</button>
//     </div>
//   );
// };

// export default App;
















// //////////////////////////////////////////////////////////////////////////////////
// // The below code uses a smaller model for testing purposes.
// // It is not recommended for production use.

// import React, { useState, useEffect } from 'react';
// import { pipeline } from '@huggingface/transformers';

// const App = () => {
//   const [chatHistory, setChatHistory] = useState('');
//   const [pipelineInstance, setPipelineInstance] = useState(null);

//   useEffect(() => {
//     const initializePipeline = async () => {
//       try {
//         if (!pipelineInstance) {
//           // Initialize the pipeline with a reliable model like DistilGPT-2
//           const pipe = await pipeline('text-generation', 'gpt2');
//           setPipelineInstance(pipe);
//         }
//       } catch (error) {
//         console.error('Error initializing the pipeline:', error);
//       }
//     };
//     initializePipeline();
//   }, [pipelineInstance]);

//   const sendMessage = async () => {
//     const promptInput = document.getElementById('prompt');

//     if (!promptInput) {
//       console.error('Failed to select necessary input element');
//       return;
//     }

//     const promptValue = promptInput.value;

//     try {
//       if (typeof pipelineInstance !== 'function') {
//         throw new TypeError('pipelineInstance is not a function');
//       }

//       // Generate text based on the input prompt.
//       const generatedText = await pipelineInstance(promptValue, {
//         max_length: 100,
//         temperature: 0.7,
//       });

//       if (generatedText) {
//         setChatHistory(prevHistory =>
//           prevHistory + `<p><strong>You:</strong> ${promptValue}</p><p><strong>Assistant:</strong> ${generatedText[0]?.generated_text || ''}</p>`
//         );
//         promptInput.value = '';
//       } else {
//         console.error('Failed to retrieve generated text');
//       }
//     } catch (error) {
//       console.error('Error in sendMessage():', error);
//     }
//   };

//   return (
//     <div>
//       <h1>Text Generation</h1>
//       <div id="chatHistory" dangerouslySetInnerHTML={{ __html: chatHistory }} />
//       <input type="text" id="prompt" placeholder="Enter your message" />
//       <button onClick={sendMessage}>Generate Text</button>
//     </div>
//   );
// };

// export default App;















////////////////////////////////////////////////////////////////////////////////
// In the below code, we are using the onnxruntime-web library to load the ONNX model and run inference.

// import React, { useState, useEffect } from 'react';
// import * as ort from 'onnxruntime-web/webgpu'; // Use WebGPU backend

// const App = () => {
//   const [chatHistory, setChatHistory] = useState('');
//   const [session, setSession] = useState(null);
//   const [isLoading, setIsLoading] = useState(true);
//   const [error, setError] = useState(null);

//   useEffect(() => {
//     const initializeSession = async () => {
//       try {
//         setIsLoading(true);
//         setError(null);

//         console.log('%c[Initialization] Starting the model loading process...', 'color: blue; font-weight: bold;');

//         const modelUrl = 'https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16/resolve/main/onnx/model_q4.onnx';
//         const dataUrl = 'https://huggingface.co/Xenova/Phi-3-mini-4k-instruct_fp16/resolve/main/onnx/model_q4.onnx_data';

//         console.time('[Fetching] ONNX Model');
//         const modelResponse = await fetch(modelUrl);
//         console.timeEnd('[Fetching] ONNX Model');
//         if (!modelResponse.ok) throw new Error('Failed to fetch the ONNX model.');
//         const modelArrayBuffer = await modelResponse.arrayBuffer();

//         console.time('[Fetching] ONNX Data');
//         const dataResponse = await fetch(dataUrl);
//         console.timeEnd('[Fetching] ONNX Data');
//         if (!dataResponse.ok) throw new Error('Failed to fetch the ONNX data.');
//         const dataArrayBuffer = await dataResponse.arrayBuffer();

//         // Set up the InferenceSession with the model buffer and manually handle the external data
//         const session = await ort.InferenceSession.create(modelArrayBuffer, {
//           executionProviders: ['webgpu'],
//           executionProviderOptions: {
//             webgpu: {},
//           },
//           // Here we try to explicitly handle the external data buffer if needed
//           graphOptimizationLevel: 'all', // you can optimize graph loading
//           enableProfiling: true, // enable profiling for debugging performance
//         });

//         // Ensure external data is loaded properly
//         await session.loadExternalData(dataArrayBuffer);

//         setSession(session);
//         console.log('%c[Success] ONNX Session created successfully.', 'color: green; font-weight: bold;');
//       } catch (error) {
//         console.error('%c[Error] Session Initialization Failed:', 'color: red;', error);
//         setError('Failed to initialize the model. Please try again later.');
//       } finally {
//         setIsLoading(false);
//         console.log('%c[Initialization] Model loading process completed.', 'color: blue; font-weight: bold;');
//       }
//     };

//     initializeSession();
//   }, []);

//   const sendMessage = async () => {
//     const promptInput = document.getElementById('prompt');

//     if (!promptInput) {
//       console.error('%c[Error] Failed to select necessary input element.', 'color: red;');
//       return;
//     }

//     const promptValue = promptInput.value;

//     try {
//       if (!session) {
//         throw new Error('ONNX session is not initialized.');
//       }

//       console.log('%c[Inference] Preparing input tensor...', 'color: purple;');
//       const inputTensor = new ort.Tensor('float32', Float32Array.from([/* Actual data transformation here */]), [/* Dimensions */]);

//       const feeds = { input: inputTensor };

//       console.log('%c[Inference] Running model inference...', 'color: purple;');
//       const results = await session.run(feeds);

//       const generatedText = results.output.data;
//       console.log('%c[Output] Generated text:', 'color: green;', generatedText);

//       if (generatedText) {
//         setChatHistory(prevHistory =>
//           prevHistory + `<p><strong>You:</strong> ${promptValue}</p><p><strong>Assistant:</strong> ${generatedText}</p>`
//         );
//         promptInput.value = '';
//       } else {
//         console.error('%c[Error] Failed to retrieve generated text.', 'color: red;');
//       }
//     } catch (error) {
//       console.error('%c[Error] Inference Failed:', 'color: red;', error);
//       setError('Failed to generate a response. Please try again.');
//     }
//   };

//   if (isLoading) {
//     return <div>Loading model, please wait...</div>;
//   }

//   if (error) {
//     return <div>Error: {error}</div>;
//   }

//   return (
//     <div>
//       <h1>Text Generation</h1>
//       <div id="chatHistory" dangerouslySetInnerHTML={{ __html: chatHistory }} />
//       <input type="text" id="prompt" placeholder="Enter your message" />
//       <button onClick={sendMessage}>Generate Text</button>
//     </div>
//   );
// };

// export default App;
