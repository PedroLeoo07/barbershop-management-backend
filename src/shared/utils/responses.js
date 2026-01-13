// =====================================================
// UTILITÁRIO PROFISSIONAL DE RESPONSES PADRONIZADAS
// =====================================================

class ResponseUtils {
  // =====================================================
  // 🎯 RESPONSES DE SUCESSO
  // =====================================================

  static success(res, data = null, message = 'Operação realizada com sucesso', statusCode = 200) {
    const response = {
      success: true,
      message,
      timestamp: new Date().toISOString()
    };

    if (data !== null) {
      response.data = data;
    }

    return res.status(statusCode).json(response);
  }

  static created(res, data, message = 'Recurso criado com sucesso') {
    return ResponseUtils.success(res, data, message, 201);
  }

  static noContent(res, message = 'Operação realizada com sucesso') {
    return res.status(204).json({
      success: true,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 📊 RESPONSES COM PAGINAÇÃO
  // =====================================================

  static paginated(res, data, pagination, message = 'Dados recuperados com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      data,
      pagination: {
        currentPage: pagination.page,
        totalPages: pagination.totalPages,
        totalItems: pagination.totalItems,
        itemsPerPage: pagination.limit,
        hasNext: pagination.hasNext,
        hasPrev: pagination.hasPrev
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 📈 RESPONSES COM METADADOS
  // =====================================================

  static withMetadata(res, data, metadata = {}, message = 'Dados recuperados com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      data,
      metadata: {
        ...metadata,
        requestId: res.locals.requestId,
        executionTime: res.locals.executionTime
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 🔍 RESPONSES DE LISTAGEM COM FILTROS
  // =====================================================

  static list(res, items, filters = {}, total = null, message = 'Lista recuperada com sucesso') {
    const response = {
      success: true,
      message,
      data: {
        items,
        count: items.length,
        ...(total !== null && { total }),
        filters: filters
      },
      timestamp: new Date().toISOString()
    };

    return res.status(200).json(response);
  }

  // =====================================================
  // 📊 RESPONSES DE DASHBOARD/ESTATÍSTICAS
  // =====================================================

  static dashboard(res, stats, message = 'Estatísticas recuperadas com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      data: {
        summary: stats.summary,
        charts: stats.charts || [],
        metrics: stats.metrics || {},
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 🔐 RESPONSES DE AUTENTICAÇÃO
  // =====================================================

  static authSuccess(res, token, user, refreshToken = null, message = 'Autenticação realizada com sucesso') {
    const response = {
      success: true,
      message,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        expiresIn: '24h'
      },
      timestamp: new Date().toISOString()
    };

    if (refreshToken) {
      response.data.refreshToken = refreshToken;
    }

    return res.status(200).json(response);
  }

  static logout(res, message = 'Logout realizado com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 📅 RESPONSES ESPECÍFICAS PARA AGENDAMENTOS
  // =====================================================

  static appointmentCreated(res, appointment, availableSlots = null) {
    const response = {
      success: true,
      message: 'Agendamento criado com sucesso',
      data: {
        appointment,
        confirmationCode: appointment.confirmationCode || appointment.id
      },
      timestamp: new Date().toISOString()
    };

    if (availableSlots) {
      response.data.nextAvailableSlots = availableSlots;
    }

    return res.status(201).json(response);
  }

  static appointmentUpdated(res, appointment, changes = {}) {
    return res.status(200).json({
      success: true,
      message: 'Agendamento atualizado com sucesso',
      data: {
        appointment,
        changes
      },
      timestamp: new Date().toISOString()
    });
  }

  static availableSlots(res, slots, date, barberId = null) {
    return res.status(200).json({
      success: true,
      message: 'Horários disponíveis recuperados',
      data: {
        date,
        barberId,
        slots,
        totalAvailable: slots.length
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 📨 RESPONSES DE OPERAÇÕES ASSÍNCRONAS
  // =====================================================

  static accepted(res, taskId, message = 'Operação aceita para processamento') {
    return res.status(202).json({
      success: true,
      message,
      data: {
        taskId,
        status: 'processing',
        statusUrl: `/api/tasks/${taskId}/status`
      },
      timestamp: new Date().toISOString()
    });
  }

  static taskStatus(res, task) {
    return res.status(200).json({
      success: true,
      message: 'Status da tarefa recuperado',
      data: {
        taskId: task.id,
        status: task.status, // pending, processing, completed, failed
        progress: task.progress || 0,
        result: task.result,
        error: task.error,
        createdAt: task.createdAt,
        completedAt: task.completedAt
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 🎨 RESPONSES DE UPLOAD/DOWNLOAD
  // =====================================================

  static uploadSuccess(res, fileInfo, message = 'Upload realizado com sucesso') {
    return res.status(201).json({
      success: true,
      message,
      data: {
        filename: fileInfo.filename,
        originalName: fileInfo.originalName,
        size: fileInfo.size,
        type: fileInfo.type,
        url: fileInfo.url,
        uploadedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  static downloadReady(res, downloadInfo) {
    return res.status(200).json({
      success: true,
      message: 'Download preparado com sucesso',
      data: {
        downloadUrl: downloadInfo.url,
        filename: downloadInfo.filename,
        size: downloadInfo.size,
        expiresAt: downloadInfo.expiresAt
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 🔄 RESPONSES DE VALIDAÇÃO
  // =====================================================

  static validationSuccess(res, validatedData, message = 'Validação realizada com sucesso') {
    return res.status(200).json({
      success: true,
      message,
      data: {
        isValid: true,
        validatedData
      },
      timestamp: new Date().toISOString()
    });
  }

  static validationFailed(res, errors, message = 'Dados inválidos') {
    return res.status(422).json({
      success: false,
      message,
      errors,
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 📊 RESPONSES DE RELATÓRIOS
  // =====================================================

  static report(res, reportData, format = 'json', message = 'Relatório gerado com sucesso') {
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.csv"`);
      return res.send(reportData);
    }

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${Date.now()}.pdf"`);
      return res.send(reportData);
    }

    return res.status(200).json({
      success: true,
      message,
      data: reportData,
      format,
      generatedAt: new Date().toISOString(),
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 🎯 HELPERS PARA CONSTRUÇÃO DE RESPONSES
  // =====================================================

  static buildPagination(page, limit, total) {
    const totalPages = Math.ceil(total / limit);
    
    return {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    };
  }

  static buildLinks(req, pagination) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
    const query = { ...req.query };

    const links = {};

    if (pagination.hasPrev) {
      query.page = pagination.page - 1;
      links.prev = `${baseUrl}?${new URLSearchParams(query).toString()}`;
    }

    if (pagination.hasNext) {
      query.page = pagination.page + 1;
      links.next = `${baseUrl}?${new URLSearchParams(query).toString()}`;
    }

    query.page = 1;
    links.first = `${baseUrl}?${new URLSearchParams(query).toString()}`;

    query.page = pagination.totalPages;
    links.last = `${baseUrl}?${new URLSearchParams(query).toString()}`;

    return links;
  }

  // =====================================================
  // 🛠️ MIDDLEWARE PARA ADICIONAR METADADOS
  // =====================================================

  static addMetadata() {
    return (req, res, next) => {
      const startTime = Date.now();
      res.locals.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Override do res.json para adicionar tempo de execução
      const originalJson = res.json;
      res.json = function(data) {
        res.locals.executionTime = Date.now() - startTime;
        
        if (data && typeof data === 'object' && data.success !== undefined) {
          data.requestId = res.locals.requestId;
          data.executionTime = `${res.locals.executionTime}ms`;
        }
        
        return originalJson.call(this, data);
      };

      next();
    };
  }

  // =====================================================
  // 📈 RESPONSE DE MÉTRICAS DE PERFORMANCE
  // =====================================================

  static performance(res, metrics) {
    return res.status(200).json({
      success: true,
      message: 'Métricas de performance',
      data: {
        response_time: metrics.responseTime,
        memory_usage: process.memoryUsage(),
        cpu_usage: process.cpuUsage(),
        uptime: process.uptime(),
        load_average: require('os').loadavg(),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }

  // =====================================================
  // 💡 RESPONSE DE HEALTH CHECK
  // =====================================================

  static health(res, checks = {}) {
    const allHealthy = Object.values(checks).every(check => check.healthy);
    const statusCode = allHealthy ? 200 : 503;

    return res.status(statusCode).json({
      success: allHealthy,
      message: allHealthy ? 'Sistema saudável' : 'Sistema com problemas',
      data: {
        status: allHealthy ? 'healthy' : 'unhealthy',
        checks,
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  }
}

module.exports = { ResponseUtils };