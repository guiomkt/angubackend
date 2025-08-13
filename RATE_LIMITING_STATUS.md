# 🚨 Status do Rate Limiting

## ⚠️ ATUALMENTE DESABILITADO

**Data da Desabilitação:** $(date)
**Motivo:** Erros 429 (Too Many Requests) durante desenvolvimento

## 🔧 Como Reativar

### 1. Editar `src/index.ts`

```typescript
// Descomente estas linhas:
import rateLimit from 'express-rate-limit';

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});

// E descomente esta linha:
app.use(limiter);
```

### 2. Configuração Recomendada para Produção

```typescript
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Aumentar para 1000 requests por 15 minutos
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Pular rate limiting para health checks
    return req.path === '/health';
  }
});
```

## 📊 Configurações por Ambiente

### Desenvolvimento
- **Rate Limiting:** ❌ DESABILITADO
- **Motivo:** Muitas requisições simultâneas durante desenvolvimento

### Produção
- **Rate Limiting:** ✅ ATIVO
- **Limite:** 1000 requests por 15 minutos por IP
- **Exceções:** Health checks e endpoints críticos

## 🚀 Próximos Passos

1. **Desenvolvimento:** Manter desabilitado até resolver as múltiplas chamadas
2. **Teste:** Implementar rate limiting com limites mais altos
3. **Produção:** Ativar com configurações otimizadas
4. **Monitoramento:** Acompanhar métricas de uso da API

## 📝 Notas Técnicas

- **Problema Original:** Frontend fazendo múltiplas chamadas simultâneas
- **Solução Temporária:** Desabilitar rate limiting
- **Solução Definitiva:** Otimizar frontend para reduzir requisições desnecessárias
- **Impacto:** Sistema aceita todas as requisições sem limitação 