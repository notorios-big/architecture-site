# Organizador de Keywords con IA

Herramienta para agrupar y organizar keywords basándose en intención de búsqueda usando embeddings y refinamiento con IA.

## Características

### 🎯 Agrupamiento Automático
- Agrupa keywords por similitud semántica usando embeddings de OpenAI
- Algoritmo greedy-clique basado en centralidad de grafos
- Umbral de similitud configurable

### 🤖 Refinamiento con IA (Claude Sonnet 4.5) - 3 Etapas

El sistema ahora cuenta con 3 funcionalidades separadas y especializadas:

#### 1. 🧹 Limpieza de Grupos
- Analiza batches de 50 grupos
- Identifica keywords que no pertenecen a cada grupo
- Mueve keywords huérfanas al grupo especial **"LLM-POR-CLASIFICAR"**
- Asigna títulos representativos a cada grupo basados en la keyword más relevante

#### 2. 🎯 Clasificación de Keywords
- Clasifica keywords desde el grupo "LLM-POR-CLASIFICAR"
- **Flujo híbrido eficiente**:
  1. Pre-filtro con embeddings (producto punto con TODOS los grupos)
  2. Selecciona candidatos con similitud > 0.3 (20-40 grupos típicamente)
  3. LLM evalúa SOLO estos candidatos
  4. Decisión final: grupo más semánticamente apropiado
- Puede crear nuevos grupos si ninguno es apropiado

#### 3. 🌳 Generación de Jerarquías
- Crea conexiones padre-hijo entre grupos
- Ejemplo: "Dupes" → ["Dupes Mujer", "Dupes Hombre"]
- Solo crea jerarquías cuando tiene sentido semántico y de arquitectura web

### 📝 Contexto del Nicho
- Archivo `niche-context.json` personalizable por proyecto
- Define equivalencias de términos (ej: dupes = clones = réplicas)
- Especifica reglas de agrupación del dominio
- Incluye ejemplos de buenos y malos grupos
- La IA utiliza este contexto en todas sus decisiones

### 📊 Visualización
- Vista de árbol jerárquica con drag & drop
- Estadísticas de volumen en tiempo real
- Edición inline de nombres de grupos

## Instalación

```bash
# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env
# Editar .env con tus API keys
```

## Variables de Entorno

```env
# OpenAI API Key (requerido para agrupamiento)
OPENAI_API_KEY=sk-proj-...

# Anthropic API Key (requerido para refinamiento con IA)
ANTHROPIC_API_KEY=sk-ant-...

# Puerto del servidor (opcional, default: 3000)
PORT=3000
```

## Uso

### 1. Iniciar el servidor

```bash
npm start
```

El servidor estará disponible en `http://localhost:3000`

### 2. Cargar keywords

- Haz clic en "Cargar CSV"
- Formato esperado: `keyword,volume`
  ```csv
  keyword,volume
  agua purificada,15000
  agua mineral,12000
  ```

### 3. Crear agrupación automática

- Ajusta el **threshold** (umbral de similitud) entre 0.5 y 1.0
  - `0.8`: Recomendado (grupos más coherentes)
  - `0.7`: Grupos más grandes pero menos precisos
  - `0.9`: Grupos muy específicos pero más pequeños
- Haz clic en "✨ Crear Agrupación"
- El sistema generará grupos basados en similitud semántica

### 4. Refinar grupos con IA (3 pasos) 🆕

Una vez creados los grupos iniciales, el refinamiento se hace en 3 etapas separadas:

#### Paso 1: 🧹 Limpiar Grupos
1. Haz clic en **"🧹 1. Limpiar Grupos"**
2. El sistema procesará los grupos en batches de 50
3. Claude Haiku 4.5:
   - Identifica keywords que no pertenecen a cada grupo
   - Asigna títulos representativos
   - Mueve keywords huérfanas a "LLM-POR-CLASIFICAR"

**Ejemplo:**

**Antes:**
- Grupo: "perfumes" → ["dupe good girl", "perfume mujer dulce", "fragancia", "clon 212"]

**Después:**
- Grupo: "Dupe Good Girl" → ["dupe good girl"]
- Grupo: "Dupe 212" → ["clon 212"]
- Grupo: "LLM-POR-CLASIFICAR" → ["perfume mujer dulce", "fragancia"]

#### Paso 2: 🎯 Clasificar Keywords
1. Haz clic en **"🎯 2. Clasificar Keywords"** (solo aparece si existe el grupo "LLM-POR-CLASIFICAR")
2. Para cada keyword:
   - Pre-filtro con embeddings (similitud > 0.3)
   - LLM evalúa candidatos y decide grupo final
   - Puede crear nuevos grupos si es necesario
3. Progreso en tiempo real

**Ejemplo:**

Keyword "perfume mujer dulce":
1. Producto punto con todos los grupos
2. Pre-filtro: ["Dupe Good Girl" (0.65), "Perfumes Dulces Mujer" (0.72), ...]
3. LLM: "Pertenece a 'Perfumes Dulces Mujer' - es una búsqueda general"
4. Se mueve al grupo correspondiente

#### Paso 3: 🌳 Generar Jerarquías
1. Haz clic en **"🌳 3. Generar Jerarquías"**
2. Claude analiza todos los grupos
3. Identifica relaciones padre-hijo lógicas
4. Crea la estructura jerárquica

**Ejemplo:**

**Antes (flat):**
- Dupes Carolina Herrera
- Dupe Good Girl
- Dupe 212 VIP
- Dupes Perfumes Mujer
- Perfumes Dulces Mujer

**Después (jerárquico):**
- Dupes Carolina Herrera
  - Dupe Good Girl
  - Dupe 212 VIP
- Dupes Perfumes Mujer
  - Perfumes Dulces Mujer

## Criterios de Refinamiento

El modelo considera que dos grupos deben **fusionarse** si:
- Tienen la misma intención de búsqueda
- Representarían la misma landing page/URL
- Ejemplo: "cómo hacer brownies" + "receta de brownies"

El modelo **separa** keywords si:
- Tienen diferentes intenciones de búsqueda
- Necesitan diferentes landing pages
- Ejemplo: "dupe de 212 hombre" vs "dupe de one million"

## Arquitectura

### Backend
- `server.js`: Express server con endpoints principales:
  - `POST /api/embeddings`: Genera embeddings usando OpenAI text-embedding-3-large
  - `POST /api/clean-groups`: Limpia grupos y mueve keywords a LLM-POR-CLASIFICAR
  - `POST /api/classify-keywords`: Clasifica una keyword en el grupo más apropiado
  - `POST /api/generate-hierarchies`: Genera conexiones padre-hijo entre grupos
- `niche-context.json`: Configuración del nicho (equivalencias, reglas, ejemplos)

### Frontend
- `public/src/App.jsx`: Componente principal de la aplicación
- `public/src/lib/api.js`: Funciones de API
- `public/src/views/TreeView.jsx`: Visualización de árbol
- `public/src/store.js`: Hook de estado (alternativo)

### Algoritmo de Agrupamiento

1. **Generación de embeddings**: Convierte keywords a vectores usando `text-embedding-3-small`
2. **Cálculo de similitud**: Matriz de similitud coseno entre todos los pares
3. **Cálculo de centralidad**: Cuenta conexiones ≥ threshold para cada keyword
4. **Greedy-clique**: Forma grupos donde todas las keywords son similares entre sí
5. **Ordenamiento**: Por volumen y alfabético

### Algoritmos de Refinamiento

#### Limpieza de Grupos
1. **División en batches**: Procesa 50 grupos por batch
2. **Análisis con LLM**: Identifica keywords fuera de lugar en cada grupo (Claude Haiku 4.5)
3. **Generación de títulos**: Sugiere nombre representativo por grupo
4. **Aplicación de cambios**: Actualiza grupos y crea/actualiza "LLM-POR-CLASIFICAR"
5. **Reordenamiento**: Ordena el árbol final por volumen

#### Clasificación de Keywords
1. **Generación de embeddings**: Para todas las keywords a clasificar y representantes de grupos
2. **Pre-filtro por similitud**: Producto punto con todos los grupos, filtra > 0.3
3. **Selección de candidatos**: Top 40 grupos más similares
4. **Clasificación con LLM**: Evalúa candidatos y decide grupo final o crear nuevo
5. **Aplicación iterativa**: Procesa keyword por keyword
6. **Limpieza final**: Elimina grupo "LLM-POR-CLASIFICAR" si queda vacío

#### Generación de Jerarquías
1. **Análisis con LLM**: Claude analiza todos los grupos
2. **Identificación de padres**: Grupos que son categorías generales
3. **Identificación de hijos**: Grupos que son subcategorías/productos específicos
4. **Aplicación de jerarquías**: Mueve grupos hijos dentro de padres
5. **Reordenamiento**: Ordena el árbol jerárquico final

## Costos Estimados

### OpenAI (Embeddings)
- Modelo: `text-embedding-3-large`
- Costo: ~$0.02 por 1M tokens
- 1000 keywords ≈ $0.001

### Anthropic (Refinamiento)

**Limpieza de grupos:**
- Modelo: `claude-haiku-4-5`
- Costo por batch de 50 grupos: ~$0.02-0.05
- 1000 grupos ≈ $0.40-1.00

**Clasificación de keywords:**
- Modelo: `claude-sonnet-4-5-20250929`
- Costo por keyword: ~$0.01-0.02
- 100 keywords ≈ $1.00-2.00

**Generación de jerarquías:**
- Modelo: `claude-sonnet-4-5-20250929`
- Costo por análisis completo: ~$0.05-0.15 (una sola llamada)

## Configuración del Contexto del Nicho

El archivo `niche-context.json` permite personalizar el comportamiento de la IA según tu nicho específico.

### Estructura del archivo

```json
{
  "nicho": "perfumes-dupes",
  "descripcion": "Sitio web especializado en perfumes alternativos",

  "equivalencias": {
    "dupes": ["clones", "perfumes replica", "inspiraciones", "alternativas"]
  },

  "categorias_principales": [
    {
      "nombre": "Tipo de Fragancia",
      "valores": ["dulce", "fresco", "amaderado", "floral"]
    }
  ],

  "reglas_agrupacion": [
    "Keywords que mencionan el mismo perfume original deben estar en el mismo grupo",
    "Keywords con diferente genero (mujer vs hombre) deben estar en grupos separados"
  ],

  "ejemplos_buenos_grupos": [...],
  "ejemplos_malos_grupos": [...],
  "jerarquias_logicas": {...}
}
```

### Cómo personalizar

1. Edita `niche-context.json` en la raíz del proyecto
2. Define las equivalencias específicas de tu nicho
3. Especifica reglas de agrupación claras
4. Proporciona ejemplos buenos y malos
5. La IA usará este contexto en todas las decisiones

El archivo de ejemplo incluye una configuración completa para el nicho de perfumes dupes.

## Troubleshooting

### Error: "ANTHROPIC_API_KEY no configurada"
Asegúrate de tener el archivo `.env` con la API key de Anthropic:
```env
ANTHROPIC_API_KEY=sk-ant-...
```

### Error: "OPENAI_API_KEY no configurada"
Agrega tu API key de OpenAI en `.env`:
```env
OPENAI_API_KEY=sk-proj-...
```

### El refinamiento no funciona
1. Verifica que tienes grupos creados (ejecuta primero "Crear Agrupación")
2. Revisa la consola del navegador para ver logs detallados
3. Verifica que el servidor esté corriendo en el puerto correcto

## Roadmap

- [ ] Exportar a Google Sheets
- [ ] Sugerencias de URLs basadas en grupos
- [ ] Análisis de competencia por grupo
- [ ] Refinamiento incremental (solo grupos nuevos)
- [ ] Vista de diagrama de flujo mejorada

## Licencia

MIT
