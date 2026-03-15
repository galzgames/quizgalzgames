# 🎮 Galz Games Quiz — v4 (Foto + Música)

Quiz ao vivo com 3 tipos de pergunta: **Texto**, **Foto** e **Música**.

## Novidades desta versão

- **📸 Quiz de Foto**: 4 imagens como opções de resposta — jogadores clicam na foto correta
- **🎵 Quiz de Música**: Admin faz upload de um trecho de áudio + 4 opções de texto para adivinhar
- **📝 Quiz de Texto**: igual antes, 4 opções de texto
- O admin pode **misturar** os 3 tipos no mesmo quiz!

---

## 🔥 Firebase — Configuração adicional para fotos e músicas

Além do Realtime Database, você precisa ativar o **Firebase Storage** para uploads.

### 1. Ativar Storage
1. No Firebase Console → **Compilação → Storage**
2. Clique em **"Primeiros passos"**
3. Escolha **"Iniciar no modo de teste"** → Avançar → Concluído

### 2. Regras do Storage
Na aba **Regras** do Storage, substitua por:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read, write: if true;
    }
  }
}
```
Clique em **Publicar**.

---

## 🚀 Publicar no GitHub Pages

1. Substitua os 3 arquivos antigos pelos novos: `index.html`, `style.css`, `app.js`
2. O site já vai estar disponível no mesmo link de antes

---

## 🎯 Como criar quiz de foto

1. No editor → clique **"+ Adicionar Pergunta"** → **📸 Foto**
2. Escreva a pergunta (ex: "Quem é essa pessoa?")
3. Clique em cada área para enviar uma foto (JPG/PNG, máx 5MB cada)
4. Opcionalmente adicione legenda em cada foto
5. Selecione qual foto é a correta (A/B/C/D)

## 🎵 Como criar quiz de música

1. No editor → **"+ Adicionar Pergunta"** → **🎵 Música**
2. Escreva a pergunta (ex: "Que música é essa?")
3. Clique para enviar o trecho de áudio (MP3/OGG, máx 10MB)
4. Preencha as 4 opções de resposta (nome das músicas/artistas)
5. Selecione a opção correta

---

## ⚠️ Limites do plano gratuito Firebase (Spark)
- Storage: **5 GB** de armazenamento
- Download: **1 GB/dia**
- Para uso casual/eventos, é mais que suficiente!
