// In-memory model configuration store per threadID
const modelStore = new Map();

// Available models list with human-friendly indexes
const AVAILABLE_MODELS = [
  { id: "1", name: "openai/gpt-5.6-sol", label: "GPT-5.6 Sol (Default - Fast & High Quality)" },
  { id: "2", name: "openai/gpt-5.6-terra", label: "GPT-5.6 Terra (Detailed & Balanced)" },
  { id: "3", name: "openai/gpt-5.6-luna", label: "GPT-5.6 Luna (High Quality Fallback)" },
  { id: "4", name: "openai/gpt-5.4-mini", label: "GPT-5.4 Mini (Ultra Fast)" }
];

const DEFAULT_MODEL = "openai/gpt-5.6-sol";

/**
 * Gets the active AI model for a thread
 * @param {string} threadID 
 * @returns {string} active model name
 */
function getActiveModel(threadID) {
  return modelStore.get(threadID) || DEFAULT_MODEL;
}

/**
 * Sets the active AI model for a thread
 * @param {string} threadID 
 * @param {string} modelName 
 */
function setActiveModel(threadID, modelName) {
  modelStore.set(threadID, modelName);
}

/**
 * Resets active model to default
 * @param {string} threadID 
 */
function resetModel(threadID) {
  modelStore.delete(threadID);
}

module.exports = {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  getActiveModel,
  setActiveModel,
  resetModel
};
