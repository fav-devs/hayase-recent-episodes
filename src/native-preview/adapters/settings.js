export { preferences as settings } from './context.js';
export const SUPPORTS = { isUnderPowered: navigator.platform === 'Linux armv8l' || navigator.deviceMemory < 4 || navigator.userAgent.includes('AndroidTV') };
export default SUPPORTS;
