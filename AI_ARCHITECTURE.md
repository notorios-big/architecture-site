# Arquitectura del Proyecto: Organizador de Keywords

## 📋 Descripción General

Este es un **organizador de keywords con agrupación automática usando IA**. Permite cargar keywords desde CSV, agruparlas semánticamente usando embeddings de OpenAI, y visualizarlas en dos vistas: árbol jerárquico y flujo interactivo.

## 🏗️ Arquitectura Técnica

### Stack Tecnológico
- **Frontend**: React 18 (sin build, usando Babel en el navegador)
- **Backend**: Node.js + Express
- **IA**: OpenAI Embeddings API (text-embedding-3-small)
- **Visualización**:
  - Vista de Árbol: Custom React components
  - Vista de Flujo: React Flow Renderer
- **Estilos**: TailwindCSS via CDN + Custom CSS

### Estructura de Archivos

```
architecture-site/
├── server.js                 # Backend Node.js con endpoint de embeddings
├── package.json              # Dependencias del servidor
├── .env                      # OPENAI_API_KEY (no commiteado)
└── public/                   # Frontend estático
    ├── index.html            # Punto de entrada (carga React, Babel, ReactFlow)
    ├── styles.css            # Estilos globales y para ReactFlow
    └── src/
        ├── App.jsx           # Componente principal (orquestador)
        ├── components/
        │   ├── KeywordModal.jsx  # Modal para ver keywords de un grupo
        │   └── Toolbar.jsx       # (No usado actualmente)
        ├── views/
        │   ├── TreeView.jsx      # Vista de árbol jerárquico
        │   └── FlowView.jsx      # Vista de flujo interactivo (ReactFlow)
        ├── lib/
        │   ├── storage.js        # LocalStorage wrapper
        │   ├── icons.js          # Componentes de iconos SVG
        │   ├── csv.js            # Parser de CSV
        │   ├── vectors.js        # Funciones de cosine similarity
        │   ├── tree.js           # Funciones de manipulación del árbol
        │   ├── tree-helpers.js   # Helpers adicionales
        │   └── api.js            # Llamadas al backend
        └── store.js              # (No usado actualmente)
```

## 🔄 Flujo de Datos

### 1. Carga de Keywords (CSV)
```
Usuario carga CSV → parseCSV() → [{id, keyword, volume, isGroup: false}]
→ Se crea grupo raíz "Sin agrupar" → setTree([root])
```

### 2. Agrupación Automática con IA
```
Usuario presiona "Crear Agrupación"
→ getEmbeddingsBatch(keywords) → OpenAI API
→ Cálculo de cosine similarity entre todos los pares
→ Agrupación por threshold (>= 0.8 por defecto)
→ Cada grupo toma el nombre de la keyword con mayor volumen
→ sortGroupChildren() para ordenar por volumen
→ setTree(sortedGroups)
```

### 3. Visualización

**Vista de Árbol (TreeView.jsx)**
- Muestra jerarquía colapsable
- Drag & Drop para reorganizar
- Edición inline de nombres de grupos
- Borrado de nodos

**Vista de Flujo (FlowView.jsx)**
- Layout horizontal (padres a la izquierda, hijos a la derecha)
- Nodos custom con gradiente púrpura
- Conexiones animadas entre grupos
- **Pendiente**: Drag & drop de nodos, crear/eliminar conexiones

## 📊 Estructura de Datos

### Nodo (Node)
```javascript
{
  id: string,              // UID único
  keyword?: string,        // Si es keyword individual
  name?: string,           // Si es grupo
  volume: number,          // Volumen de búsqueda
  isGroup: boolean,        // true para grupos, false para keywords
  collapsed?: boolean,     // Solo grupos: estado de colapso en TreeView
  children?: Node[]        // Solo grupos: hijos (keywords o subgrupos)
}
```

### Árbol (Tree)
```javascript
tree: Node[]  // Array de nodos raíz (pueden ser grupos o keywords)
```

## 🎯 Estado Global (en App.jsx)

```javascript
// Datos
keywords: []           // Keywords cargadas del CSV original
tree: []               // Árbol de grupos y keywords

// UI - Vista de Árbol
dragging: Node | null
dragOver: string | null
editingId: string | null
editingText: string

// UI - Vista de Flujo
activeView: 'tree' | 'flow'
expandedNodes: Set<string>    // IDs de nodos expandidos en FlowView
keywordModal: Node | null     // Grupo cuyas keywords se están viendo

// Configuración
threshold: number      // 0.5 - 1.0 para similaridad semántica
loading: boolean
error: string
success: string
```

## 🔧 Funciones Clave

### Manipulación del Árbol

**nodeVolume(node)**: Calcula volumen recursivamente
- Keyword: retorna su volumen
- Grupo: suma volúmenes de todos los descendientes (con cache)

**sortGroupChildren(nodes)**: Ordena recursivamente
1. Keywords primero (mayor a menor volumen)
2. Luego grupos (mayor a menor volumen)
3. Alfabético en caso de empate

**toggleCollapse(id)**: Colapsa/expande un grupo en TreeView

**renameNode(id, name)**: Renombra un grupo

**deleteNode(id)**: Elimina un nodo (y sus hijos) del árbol

### Drag & Drop (TreeView)

**onDrop(target, dragged)**:
1. Validar: target es grupo, no es el mismo, no es descendiente
2. removeNode(dragged.id, tree)
3. insertInto(target.id, dragged, tree)
4. sortOnlyAffectedNode(tree, target.id)  // Optimización
5. Invalidar cache de volúmenes

### Import/Export

**exportJSON()**: Descarga el árbol como JSON

**importJSON()**: Carga árbol desde JSON y reordena

## 🎨 Estilos y UX

### Clases CSS Importantes
- `.glass`: Fondo semitransparente con blur
- `.glass-dark`: Fondo oscuro semitransparente
- `.custom-node`: Estilo de nodos en FlowView (gradiente púrpura)
- `.node-card`: Tarjetas en TreeView
- `.drag-over`: Animación de pulso cuando se arrastra sobre un objetivo

### Gradiente Principal
```css
background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
```

## 🐛 Problemas Conocidos y Limitaciones

1. **ReactFlow no funciona actualmente**: La integración con react-flow-renderer está rota
   - Problema: API v10 vs v11 es diferente
   - Las conexiones no se visualizan
   - Drag & drop de nodos no funciona completamente

2. **Sin persistencia en servidor**: Todo es local (localStorage)

3. **Sin manejo de errores robusto**: Si falla OpenAI API, la app puede quedar en estado inconsistente

4. **Sin undo/redo**: Una vez borrado, no hay forma de recuperar

5. **Performance**: Con >1000 keywords, la UI puede volverse lenta

## 🚀 Cómo Funciona el Deploy

### Desarrollo Local
```bash
npm start  # Inicia servidor en http://localhost:3000
```

### Variables de Entorno
```bash
OPENAI_API_KEY=sk-...  # Requerido para agrupación automática
PORT=3000              # Opcional, default 3000
```

## 📝 TODOs / Mejoras Pendientes

### Vista de Flujo (Prioridad Alta)
- [ ] Arreglar ReactFlow para que funcione correctamente
- [ ] Visualizar conexiones entre grupos
- [ ] Permitir drag & drop de nodos en el canvas
- [ ] Permitir crear conexiones arrastrando entre nodos
- [ ] Permitir eliminar conexiones (click + Delete)
- [ ] Auto-layout tipo "pretty" como en n8n

### Features
- [ ] Búsqueda de keywords dentro del árbol
- [ ] Filtros por volumen
- [ ] Exportar a otros formatos (Excel, Notion, etc.)
- [ ] Subgrupos anidados (actualmente solo 2 niveles)
- [ ] Múltiples métodos de agrupación (KMeans, HDBSCAN, etc.)

### UX
- [ ] Undo/Redo
- [ ] Keyboard shortcuts
- [ ] Tour guiado para nuevos usuarios
- [ ] Modo oscuro

## 🤖 Notas para IA's

1. **No uses npm install**: El proyecto usa CDN para todas las dependencias frontend
2. **Babel en el navegador**: Los archivos .jsx se transpilan en tiempo real
3. **window.* para compartir**: Los componentes se exponen globalmente (window.App, window.FlowView, etc.)
4. **React 18**: Usa `ReactDOM.createRoot()` no `ReactDOM.render()`
5. **ReactFlow**: Actualmente problemático, preferir soluciones simples antes que librerías complejas
6. **LocalStorage puede fallar**: Hay un wrapper (storage.js) que usa memoria si localStorage no está disponible

## 🔍 Debugging

### Logs Importantes
```javascript
console.log('ReactFlow disponible:', !!window.ReactFlowRenderer);
console.log('Árbol actual:', tree);
console.log('Cache de volúmenes:', volumeCacheRef.current);
```

### Comprobar que todo carga
1. Abrir DevTools → Console
2. Verificar que no hay errores de carga de scripts
3. Verificar `typeof React !== 'undefined'`
4. Verificar `typeof window.App !== 'undefined'`
5. Verificar `typeof window.ReactFlowRenderer !== 'undefined'`

---

**Última actualización**: 2025-11-10
**Versión**: 1.0.0
