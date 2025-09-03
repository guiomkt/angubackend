import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import { authenticate, requireRestaurant, AuthenticatedRequest } from '../middleware/auth'
import { supabase } from '../config/database'

const router = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } })

router.post('/logo', authenticate, requireRestaurant, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Arquivo é obrigatório' })
    }

    const ext = path.extname(req.file.originalname) || '.jpg'
    const objectName = `${restaurantId}/${Date.now()}${ext}`

    const { error: uploadError } = await supabase.storage.from('logos').upload(objectName, req.file.buffer, {
      upsert: true,
      contentType: req.file.mimetype
    })
    if (uploadError) {
      return res.status(400).json({ success: false, error: uploadError.message })
    }

    const { data: publicData } = supabase.storage.from('logos').getPublicUrl(objectName)
    return res.status(201).json({ success: true, data: { publicUrl: publicData.publicUrl, path: objectName } })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha no upload' })
  }
})

router.delete('/logo', authenticate, requireRestaurant, async (req: AuthenticatedRequest, res) => {
  try {
    const { path: objectPath } = req.body as { path?: string }
    if (!objectPath) {
      return res.status(400).json({ success: false, error: 'Path é obrigatório' })
    }
    const { error } = await supabase.storage.from('logos').remove([objectPath])
    if (error) {
      return res.status(400).json({ success: false, error: error.message })
    }
    return res.json({ success: true })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha ao remover arquivo' })
  }
})

router.post('/chat-media', authenticate, requireRestaurant, upload.single('file'), async (req: AuthenticatedRequest, res) => {
  try {
    const restaurantId = req.user!.restaurant_id
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Arquivo é obrigatório' })
    }

    const ext = path.extname(req.file.originalname) || '.bin'
    const objectName = `${restaurantId}/${Date.now()}${ext}`

    const { error: uploadError } = await supabase.storage.from('chat-media').upload(objectName, req.file.buffer, {
      upsert: true,
      contentType: req.file.mimetype
    })
    if (uploadError) {
      return res.status(400).json({ success: false, error: uploadError.message })
    }

    const { data: publicData } = supabase.storage.from('chat-media').getPublicUrl(objectName)
    return res.status(201).json({ success: true, data: { publicUrl: publicData.publicUrl, path: objectName } })
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Falha no upload' })
  }
})

export default router 