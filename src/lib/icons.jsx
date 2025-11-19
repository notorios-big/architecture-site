// src/lib/icons.jsx
// Iconos usando Heroicons con wrapper para compatibilidad

import React from 'react';
import {
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  DocumentArrowUpIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  ArrowsPointingInIcon,
  PlusIcon,
  FolderOpenIcon,
  EyeIcon,
  ListBulletIcon,
  ShareIcon,
  MagnifyingGlassIcon,
  Bars3Icon,
  SparklesIcon,
  CogIcon,
  FolderIcon,
  DocumentTextIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline';

// Wrapper para mantener compatibilidad con API anterior
const IconWrapper = ({ Icon, size = 20, className = "" }) => (
  <Icon className={`w-${size/4} h-${size/4} ${className}`} style={{ width: size, height: size }} />
);

// Exportar componentes con la misma API
export const IUpload = (props) => <IconWrapper Icon={ArrowUpTrayIcon} {...props} />;
export const IDownload = (props) => <IconWrapper Icon={ArrowDownTrayIcon} {...props} />;
export const IFileUp = (props) => <IconWrapper Icon={DocumentArrowUpIcon} {...props} />;
export const ITrash = (props) => <IconWrapper Icon={TrashIcon} {...props} />;
export const IEdit = (props) => <IconWrapper Icon={PencilIcon} {...props} />;
export const ICheck = (props) => <IconWrapper Icon={CheckIcon} {...props} />;
export const IX = (props) => <IconWrapper Icon={XMarkIcon} {...props} />;
export const IChevronR = (props) => <IconWrapper Icon={ChevronRightIcon} {...props} />;
export const IChevronD = (props) => <IconWrapper Icon={ChevronDownIcon} {...props} />;
export const IMinimize = (props) => <IconWrapper Icon={ArrowsPointingInIcon} {...props} />;
export const IPlus = (props) => <IconWrapper Icon={PlusIcon} {...props} />;
export const IFolderOpen = (props) => <IconWrapper Icon={FolderOpenIcon} {...props} />;
export const IEye = (props) => <IconWrapper Icon={EyeIcon} {...props} />;
export const IList = (props) => <IconWrapper Icon={ListBulletIcon} {...props} />;
export const INetwork = (props) => <IconWrapper Icon={ShareIcon} {...props} />;
export const ISearch = (props) => <IconWrapper Icon={MagnifyingGlassIcon} {...props} />;
export const IMenu = (props) => <IconWrapper Icon={Bars3Icon} {...props} />;
export const ISparkles = (props) => <IconWrapper Icon={SparklesIcon} {...props} />;
export const ICog = (props) => <IconWrapper Icon={CogIcon} {...props} />;
export const IFolder = (props) => <IconWrapper Icon={FolderIcon} {...props} />;
export const IDocument = (props) => <IconWrapper Icon={DocumentTextIcon} {...props} />;
export const IChart = (props) => <IconWrapper Icon={ChartBarIcon} {...props} />;

// Exportar todos los iconos juntos
export default {
  IUpload,
  IDownload,
  IFileUp,
  ITrash,
  IEdit,
  ICheck,
  IX,
  IChevronR,
  IChevronD,
  IMinimize,
  IPlus,
  IFolderOpen,
  IEye,
  IList,
  INetwork,
  ISearch,
  IMenu,
  ISparkles,
  ICog,
  IFolder,
  IDocument,
  IChart,
};
