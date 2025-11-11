# Organizador de Keywords con IA

Herramienta para agrupar y organizar keywords basándose en intención de búsqueda usando embeddings y refinamiento con IA.

## Características

### 🎯 Agrupamiento Automático
- Agrupa keywords por similitud semántica usando embeddings de OpenAI
- Algoritmo greedy-clique basado en centralidad de grafos
- Umbral de similitud configurable

### 🤖 Refinamiento con IA (Claude Sonnet 4.5)
- **Análisis de intención de búsqueda**: Identifica la intención real detrás de cada grupo
- **Fusión inteligente**: Combina grupos con la misma intención (ej: "para que sirve la moringa" + "beneficios de la moringa")
- **División de grupos**: Separa keywords con diferentes intenciones (ej: "dupe de 212 hombre" vs "dupe de one million")
- **Renombrado automático**: Sugiere nombres que reflejen mejor la intención de búsqueda
- **Procesamiento en batches**: Maneja miles de keywords procesando grupos en batches de 12

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

### 4. Refinar grupos con IA 🆕

Una vez creados los grupos iniciales:

1. Haz clic en **"🤖 Refinar con IA"**
2. El sistema procesará los grupos en batches
3. Claude Sonnet 4.5 analizará:
   - La intención de búsqueda de cada grupo
   - Grupos que deberían fusionarse (misma intención)
   - Keywords que deberían separarse (diferente intención)
   - Nombres de grupos que no reflejan la intención

**Ejemplo de refinamiento:**

**Antes:**
- Grupo 1: "para que sirve la moringa"
- Grupo 2: "beneficios de la moringa"
- Grupo 3: "dupe de 212 hombre, dupe de one million"

**Después:**
- Grupo 1: "Beneficios de la Moringa" (fusión de grupos 1 y 2)
- Grupo 2: "Alternativas a 212 Men"
- Grupo 3: "Alternativas a One Million"

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
- `server.js`: Express server con dos endpoints principales:
  - `POST /api/embeddings`: Genera embeddings usando OpenAI
  - `POST /api/refine-groups`: Refina grupos usando Claude Sonnet 4.5

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

### Algoritmo de Refinamiento

1. **División en batches**: Procesa 12 grupos por batch
2. **Análisis con LLM**: Claude analiza intención de búsqueda
3. **Generación de sugerencias**: Fusiones, divisiones y renombres
4. **Aplicación de cambios**: Modifica el árbol según sugerencias
5. **Reordenamiento**: Ordena el árbol final por volumen

## Costos Estimados

### OpenAI (Embeddings)
- Modelo: `text-embedding-3-small`
- Costo: ~$0.02 por 1M tokens
- 1000 keywords ≈ $0.001

### Anthropic (Refinamiento)
- Modelo: `claude-sonnet-4-5`
- Costo aproximado por batch de 12 grupos: ~$0.02-0.05
- 100 grupos ≈ $0.15-0.40

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
