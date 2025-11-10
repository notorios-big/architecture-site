// src/lib/icons.js
const Icon = ({ d, size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
       stroke="currentColor" strokeWidth="2" strokeLinecap="round"
       strokeLinejoin="round" className={className}><path d={d}/></svg>
);

const IUpload = (p) => <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>;
const IDownload = (p) => <Icon {...p} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>;
const IFileUp = (p) => <Icon {...p} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M14 2v6h6M12 18v-6M9 15l3-3 3 3"/>;
const ITrash = (p) => <Icon {...p} d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>;
const IEdit = (p) => <Icon {...p} d="M17 3a2.8 2.8 0 0 1 4 4L7.5 21.5 2 22l1.5-5.5L17 3z"/>;
const ICheck = (p) => <Icon {...p} d="M20 6L9 17l-5-5"/>;
const IX = (p) => <Icon {...p} d="M18 6L6 18M6 6l12 12"/>;
const IChevronR = (p) => <Icon {...p} d="M9 18l6-6-6-6"/>;
const IChevronD = (p) => <Icon {...p} d="M6 9l6 6 6-6"/>;
const IMinimize = (p) => <Icon {...p} d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>;
const IPlus = (p) => <Icon {...p} d="M12 5v14M5 12h14"/>;
const IFolderOpen = (p) => <Icon {...p} d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>;
const IEye = (p) => <Icon {...p} d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/>;
const IList = (p) => <Icon {...p} d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>;
const INetwork = (p) => <Icon {...p} d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>;

// Hacer disponible globalmente
window.Icon = Icon;
window.IUpload = IUpload;
window.IDownload = IDownload;
window.IFileUp = IFileUp;
window.ITrash = ITrash;
window.IEdit = IEdit;
window.ICheck = ICheck;
window.IX = IX;
window.IChevronR = IChevronR;
window.IChevronD = IChevronD;
window.IMinimize = IMinimize;
window.IPlus = IPlus;
window.IFolderOpen = IFolderOpen;
window.IEye = IEye;
window.IList = IList;
window.INetwork = INetwork;

