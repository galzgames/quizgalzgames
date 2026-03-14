# 🎮 QuizArena

Quiz ao vivo com salas, código de acesso, ranking e pódio dos 3 melhores.

## ✨ Funcionalidades

- **Admin**: crie e edite quizzes com 4 opções por pergunta
- **Sala com código**: gere um código e compartilhe com os jogadores
- **Multiplayer**: jogadores entram pelo código em tempo real
- **Temporizador**: 20 segundos por pergunta (bônus de velocidade)
- **Ranking ao vivo**: placar atualizado após cada pergunta
- **Pódio final**: top 3 com destaque para o vencedor e premiação

## 🚀 Como hospedar no GitHub Pages (grátis)

### Passo 1 — Criar repositório
1. Acesse [github.com](https://github.com) e faça login
2. Clique em **"New repository"**
3. Dê um nome (ex: `quizarena`)
4. Marque **"Public"**
5. Clique em **"Create repository"**

### Passo 2 — Fazer upload dos arquivos
1. Na página do repositório, clique em **"uploading an existing file"**
2. Arraste os 3 arquivos: `index.html`, `style.css`, `app.js`
3. Clique em **"Commit changes"**

### Passo 3 — Ativar GitHub Pages
1. Vá em **Settings** (aba do repositório)
2. No menu lateral, clique em **Pages**
3. Em **Source**, selecione **"Deploy from a branch"**
4. Em **Branch**, selecione **"main"** e pasta **"/ (root)"**
5. Clique em **Save**

### Passo 4 — Acessar o site
Após ~1 minuto, seu site estará em:
```
https://SEU-USUARIO.github.io/quizarena
```

## 🎯 Como usar

### Admin
- Acesse o site → "Criar / Gerenciar Quiz"
- Login: `admin` / `1234`
- Crie ou edite um quiz
- Clique em **▶ Sala** para gerar o código

### Jogadores
- Acessam o **mesmo site** → "Entrar numa Sala"
- Digitam nome + código da sala
- Aguardam o admin iniciar

> ⚠️ **Importante**: o localStorage compartilha dados apenas entre abas do **mesmo navegador no mesmo dispositivo**. Para jogar com pessoas em dispositivos diferentes, é necessário um backend (Firebase, etc.).

## 🔧 Personalização

Para mudar a senha do admin, edite em `app.js`:
```js
if (u === 'admin' && p === '1234') {
```

Para mudar o tempo por pergunta:
```js
const TIMER_SEC = 20; // linha 8 do app.js
```

## 📁 Estrutura
```
quizarena/
├── index.html   # Estrutura HTML das telas
├── style.css    # Estilos e tema escuro
├── app.js       # Lógica do quiz e sincronização
└── README.md    # Este arquivo
```
