// /src/ui/atoms/Button.js
/**
 * Mobile-first button atom
 * @param {Object} options
 * @param {string} options.text - Button label
 * @param {string} [options.variant] - 'primary', 'secondary', 'danger'
 * @param {string} [options.size] - 'sm', 'md', 'lg'
 * @param {string} [options.icon] - Optional icon (e.g., '🏠')
 * @returns {string} HTML string
 */
export function Button({ text, variant = 'primary', size = 'md', icon = '' }) {
  const variants = {
    primary: 'bg-blue-600 hover:bg-blue-700 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800',
    danger: 'bg-red-600 hover:bg-red-700 text-white'
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return `
    <button 
      class="rounded-lg font-medium transition-colors duration-150 
             ${variants[variant]} ${sizes[size]} 
             min-h-[48px] min-w-[48px] flex items-center justify-center"
      aria-label="${text}"
    >
      ${icon ? `<span class="mr-2">${icon}</span>` : ''}
      ${text}
    </button>
  `;
}