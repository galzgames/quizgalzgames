# 🎮 Galz Games Quiz

Quiz ao vivo estilo Kahoot — funciona entre qualquer dispositivo via Firebase.

---

## 🔥 Configurar Firebase (OBRIGATÓRIO para internet)

### 1. Criar projeto Firebase (grátis)
1. Acesse: https://console.firebase.google.com
2. Clique em **"Adicionar projeto"**
3. Dê um nome (ex: `galzgames`) → Continuar → Criar projeto

### 2. Criar o Banco de Dados
1. No menu lateral, clique em **Realtime Database**
2. Clique em **"Criar banco de dados"**
3. Escolha a localização (ex: Estados Unidos) → Avançar
4. Selecione **"Iniciar no modo de teste"** → Ativar

### 3. Abrir as regras (para funcionar)
1. Ainda no Realtime Database, clique na aba **"Regras"**
2. Substitua o conteúdo por:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```
3. Clique em **Publicar**

### 4. Obter as configurações
1. Clique na engrenagem ⚙️ → **Configurações do projeto**
2. Role para baixo até **"Seus apps"**
3. Clique em **"Adicionar app"** → ícone Web `</>`
4. Dê um apelido → **Registrar app**
5. Copie os valores do objeto `firebaseConfig`

### 5. Configurar no site
1. Acesse seu site no GitHub Pages
2. Clique em **"Criar / Gerenciar"** → faça login (admin/1234)
3. Clique em **⚙️ Firebase** no dashboard
4. Cole os valores copiados → **Salvar e Conectar**

> A configuração fica salva no navegador do admin. Só precisa fazer isso uma vez por dispositivo.

---

## 🚀 Publicar no GitHub Pages

1. Crie um repositório público em github.com
2. Faça upload dos 3 arquivos: `index.html`, `style.css`, `app.js`
3. Settings → Pages → Branch: main → Save
4. Acesse: `https://SEU-USUARIO.github.io/NOME-DO-REPO`

---

## 🎯 Como jogar

**Admin (host):**
1. Acesse o site → "Criar / Gerenciar" → login: `admin` / `1234`
2. Configure o Firebase (primeiro acesso)
3. Crie ou edite um quiz
4. Clique **▶ Iniciar** → compartilhe o código
5. Quando todos entrarem → clique **Iniciar!**
6. As perguntas avançam automaticamente com contagem regressiva
7. Ao final, clique **🏆 Ver Resultados Finais** quando quiser

**Jogadores (qualquer dispositivo):**
1. Acessam o mesmo site
2. Clicam em **"Entrar no Quiz"**
3. Digitam o código → apelido → **Entrar no jogo!**

---

## 🔧 Personalizar

**Tempo por pergunta** (`app.js`, linha 9):
```js
const TIMER_SEC = 20;
```

**Tempo entre perguntas** (`app.js`, linha 10):
```js
const REVEAL_SEC = 5;
```

**Senha do admin** (`app.js`):
```js
if (u === 'admin' && p === '1234') {
```
