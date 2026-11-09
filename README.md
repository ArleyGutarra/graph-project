## Workflow con Git

**Configuración inicial**
```
# 1. Clonar el repositorio de GitHub
git clone URL_DEL_REPOSITORIO

# 2. Entrar a la carpeta del proyecto
cd graph-app

# 3. Instalar las dependencias del proyecto
npm install

# 4. Ejecutar el servidor de desarrollo
npm run dev
```

**Trabajo con ramas**
```
# 1. Actualizar la información de las ramas remotas
git fetch origin

# 2. Cambiar a la rama principal
git switch main

# 3. Descargar e integrar los últimos cambios de main
git pull

# 4. Crear una rama para su nueva funcionalidad
git switch -c feature/nombre-funcionalidad

# 5. Revisar los archivos modificados
git status

# 6. Preparar los cambios para el commit
git add .

# 7. Guardar los cambios en el historial
git commit -m "Descripción de los cambios"

# 8. Subir su rama a GitHub
git push -u origin feature/nombre-funcionalidad
```
### Basic Layout

A continuación, un esquema básico para una primera versión de la visualización de la página web. 

<img width="1111" height="703" alt="image" src="https://github.com/user-attachments/assets/9a125970-d6f4-446b-b71f-ad93511ece8f" />


### React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)


