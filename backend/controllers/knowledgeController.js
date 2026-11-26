const KnowledgeItem = require('../models/KnowledgeItem');

/**
 * 1. Get all knowledge items for current student
 */
exports.getItems = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { category, subject, search, isPinned } = req.query;

    const query = { userId };

    if (category && ['summary', 'doubt', 'note', 'flashcard'].includes(category)) {
      query.category = category;
    }

    if (subject && subject !== 'all') {
      query.subject = subject;
    }

    if (isPinned === 'true') {
      query.isPinned = true;
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { title: { $regex: q, $options: 'i' } },
        { content: { $regex: q, $options: 'i' } },
        { tags: { $in: [new RegExp(q, 'i')] } }
      ];
    }

    const items = await KnowledgeItem.find(query).sort({ isPinned: -1, createdAt: -1 });
    const subjects = await KnowledgeItem.distinct('subject', { userId });

    return res.status(200).json({
      success: true,
      data: {
        items,
        subjects: subjects.filter(Boolean),
        totalCount: items.length
      }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 2. Create a new knowledge card / saved item
 */
exports.createItem = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { title, content, category = 'note', subject = 'General Studies', tags, source, roomId, isPinned = false } = req.body;

    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title is required for knowledge item.'
      });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Content is required for knowledge item.'
      });
    }

    let parsedTags = [];
    if (Array.isArray(tags)) {
      parsedTags = tags.map(t => String(t).trim()).filter(Boolean);
    } else if (typeof tags === 'string' && tags.trim()) {
      parsedTags = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
    }

    const item = await KnowledgeItem.create({
      userId,
      roomId: roomId || undefined,
      title: title.trim(),
      content: content.trim(),
      category: ['summary', 'doubt', 'note', 'flashcard'].includes(category) ? category : 'note',
      subject: (subject && subject.trim()) ? subject.trim() : 'General Studies',
      tags: parsedTags,
      source: source || 'Personal Note',
      isPinned: !!isPinned
    });

    return res.status(201).json({
      success: true,
      message: 'Item saved to Knowledge Base.',
      data: { item }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 3. Get single item by ID
 */
exports.getItemById = async (req, res, next) => {
  try {
    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found.'
      });
    }

    return res.status(200).json({
      success: true,
      data: { item }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 4. Update knowledge item
 */
exports.updateItem = async (req, res, next) => {
  try {
    const { title, content, category, subject, tags, isPinned } = req.body;

    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found.'
      });
    }

    if (title !== undefined) item.title = title.trim();
    if (content !== undefined) item.content = content.trim();
    if (category !== undefined && ['summary', 'doubt', 'note', 'flashcard'].includes(category)) item.category = category;
    if (subject !== undefined) item.subject = subject.trim();
    if (isPinned !== undefined) item.isPinned = !!isPinned;

    if (tags !== undefined) {
      if (Array.isArray(tags)) {
        item.tags = tags.map(t => String(t).trim()).filter(Boolean);
      } else if (typeof tags === 'string') {
        item.tags = tags.split(',').map(t => t.trim().replace(/^#/, '')).filter(Boolean);
      }
    }

    await item.save();

    return res.status(200).json({
      success: true,
      message: 'Knowledge item updated.',
      data: { item }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 5. Toggle Pin status
 */
exports.togglePin = async (req, res, next) => {
  try {
    const item = await KnowledgeItem.findOne({
      _id: req.params.id,
      userId: req.session.user.id
    });

    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found.'
      });
    }

    item.isPinned = !item.isPinned;
    await item.save();

    return res.status(200).json({
      success: true,
      message: item.isPinned ? 'Item pinned to top.' : 'Item unpinned.',
      data: { item }
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 6. Delete knowledge item
 */
exports.deleteItem = async (req, res, next) => {
  try {
    const result = await KnowledgeItem.deleteOne({
      _id: req.params.id,
      userId: req.session.user.id
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found.'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Knowledge item removed.'
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * 7. Export knowledge base as formatted Markdown document
 */
exports.exportStudySheet = async (req, res, next) => {
  try {
    const userId = req.session.user.id;
    const { subject } = req.query;

    const query = { userId };
    if (subject && subject !== 'all') {
      query.subject = subject;
    }

    const items = await KnowledgeItem.find(query).sort({ subject: 1, isPinned: -1, createdAt: -1 });

    const studentName = req.session.user.name || 'Student';
    const dateStr = new Date().toLocaleDateString('en-US', { dateStyle: 'long' });

    let md = `# 📚 StudySync AI — Master Revision Sheet\n`;
    md += `**Student:** ${studentName}  \n`;
    md += `**Generated:** ${dateStr}  \n`;
    md += `**Total Topics:** ${items.length} item(s)  \n\n`;
    md += `---\n\n`;

    if (items.length === 0) {
      md += `*No notes or study items saved in the knowledge base yet.*\n`;
    } else {
      let currentSubject = '';
      items.forEach((item, index) => {
        if (item.subject !== currentSubject) {
          currentSubject = item.subject;
          md += `## 📖 Subject: ${currentSubject}\n\n`;
        }

        const categoryBadge = {
          summary: '🎓 AI Study Summary',
          doubt: '❓ Resolved Doubt',
          note: '📝 Study Note',
          flashcard: '⚡ Quick Concept'
        }[item.category] || '📝 Note';

        md += `### ${index + 1}. ${item.title}\n`;
        md += `> **Type:** ${categoryBadge} | **Source:** ${item.source || 'StudySync'} | **Saved:** ${new Date(item.createdAt).toLocaleDateString()}\n\n`;

        if (item.tags && item.tags.length > 0) {
          md += `**Tags:** ${item.tags.map(t => `\`#${t}\``).join(' ')}\n\n`;
        }

        md += `${item.content}\n\n`;
        md += `---\n\n`;
      });
    }

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="StudySync_Revision_${Date.now()}.md"`);
    return res.status(200).send(md);
  } catch (error) {
    return next(error);
  }
};
