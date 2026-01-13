// =====================================================
// GERAÇÃO AUTOMÁTICA DE HORÁRIOS (DIFERENCIAL 🚀)
// =====================================================

const { Logger } = require('../../shared/utils/Logger');
const { AppError } = require('../../shared/errors/AppError');

class SlotsGeneratorService {
  constructor() {
    // Configurações padrão da barbearia
    this.defaultConfig = {
      openHour: 9,          // 09:00
      closeHour: 18,        // 18:00
      slotDuration: 30,     // 30 minutos
      breakTime: 10,        // 10 minutos entre agendamentos
      lunchStart: 12,       // 12:00
      lunchEnd: 13,         // 13:00
      workDays: [1, 2, 3, 4, 5, 6] // Segunda a sábado
    };
  }

  // =====================================================
  // 🧠 GERAÇÃO INTELIGENTE DE SLOTS
  // =====================================================

  generateSlots(date, serviceDuration = 30, config = {}) {
    try {
      const finalConfig = { ...this.defaultConfig, ...config };
      
      const slots = [];
      const targetDate = new Date(date);
      const dayOfWeek = targetDate.getDay();

      // Verifica se o dia está nos dias de funcionamento
      if (!finalConfig.workDays.includes(dayOfWeek)) {
        Logger.appointment('No slots - closed day', { date, dayOfWeek });
        return [];
      }

      let currentHour = finalConfig.openHour;
      let currentMinute = 0;

      Logger.appointment('Generating slots', {
        date,
        serviceDuration,
        openHour: finalConfig.openHour,
        closeHour: finalConfig.closeHour
      });

      while (currentHour < finalConfig.closeHour) {
        const slotTime = this.formatTime(currentHour, currentMinute);
        const slotDateTime = new Date(targetDate);
        slotDateTime.setHours(currentHour, currentMinute, 0, 0);

        // Calcula quando esse agendamento terminaria
        const endTime = new Date(slotDateTime.getTime() + serviceDuration * 60000);
        const endHour = endTime.getHours();
        const endMinute = endTime.getMinutes();

        // Verifica se cabe antes do fechamento
        const totalEndTime = endHour + (endMinute / 60);
        if (totalEndTime > finalConfig.closeHour) {
          break;
        }

        // Verifica se não conflita com horário de almoço
        const slotTotalTime = currentHour + (currentMinute / 60);
        const isLunchTime = this.isInLunchTime(
          slotTotalTime, 
          totalEndTime, 
          finalConfig.lunchStart, 
          finalConfig.lunchEnd
        );

        if (!isLunchTime) {
          slots.push({
            time: slotTime,
            datetime: slotDateTime.toISOString(),
            displayTime: slotTime,
            available: true, // Será verificado posteriormente
            duration: serviceDuration,
            endTime: this.formatTime(endHour, endMinute)
          });
        }

        // Avança para o próximo slot (duração + intervalo)
        const nextSlotMinutes = currentMinute + serviceDuration + finalConfig.breakTime;
        currentMinute = nextSlotMinutes % 60;
        currentHour += Math.floor(nextSlotMinutes / 60);
      }

      Logger.appointment('Slots generated', {
        date,
        totalSlots: slots.length,
        serviceDuration
      });

      return slots;
    } catch (error) {
      Logger.appointment('Error generating slots', {
        date,
        serviceDuration,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 📅 GERAR SLOTS PARA MÚLTIPLOS DIAS
  // =====================================================

  generateWeekSlots(startDate, days = 7, serviceDuration = 30, config = {}) {
    try {
      const weekSlots = {};
      const start = new Date(startDate);

      for (let i = 0; i < days; i++) {
        const currentDate = new Date(start);
        currentDate.setDate(start.getDate() + i);
        
        const dateKey = this.formatDate(currentDate);
        weekSlots[dateKey] = this.generateSlots(
          currentDate.toISOString().split('T')[0], 
          serviceDuration, 
          config
        );
      }

      return weekSlots;
    } catch (error) {
      Logger.appointment('Error generating week slots', {
        startDate,
        days,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 🔍 REMOVER SLOTS OCUPADOS
  // =====================================================

  async filterAvailableSlots(slots, barberId, date, appointmentsRepository) {
    try {
      // Busca agendamentos existentes para o barbeiro na data
      const existingAppointments = await appointmentsRepository.findByBarberAndDate(barberId, date);
      
      const availableSlots = slots.map(slot => {
        const slotTime = slot.time;
        const slotDateTime = new Date(slot.datetime);

        // Verifica se há conflito com agendamentos existentes
        const hasConflict = existingAppointments.some(appointment => {
          const appointmentTime = appointment.appointment_time;
          const appointmentDuration = appointment.duration || appointment.service_duration || 30;
          
          return this.hasTimeConflict(
            slotTime,
            slot.duration,
            appointmentTime,
            appointmentDuration
          );
        });

        return {
          ...slot,
          available: !hasConflict,
          reason: hasConflict ? 'Horário ocupado' : null
        };
      });

      const availableCount = availableSlots.filter(slot => slot.available).length;
      
      Logger.appointment('Filtered available slots', {
        barberId,
        date,
        totalSlots: slots.length,
        availableSlots: availableCount,
        occupiedSlots: slots.length - availableCount
      });

      return availableSlots;
    } catch (error) {
      Logger.appointment('Error filtering available slots', {
        barberId,
        date,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 🎯 BUSCAR PRÓXIMO HORÁRIO DISPONÍVEL
  // =====================================================

  async findNextAvailable(barberId, startDate, serviceDuration, appointmentsRepository, config = {}) {
    try {
      const daysToCheck = 30; // Verifica próximos 30 dias
      
      for (let i = 0; i < daysToCheck; i++) {
        const checkDate = new Date(startDate);
        checkDate.setDate(startDate.getDate() + i);
        
        const dateStr = checkDate.toISOString().split('T')[0];
        const slots = this.generateSlots(dateStr, serviceDuration, config);
        const availableSlots = await this.filterAvailableSlots(
          slots, 
          barberId, 
          dateStr, 
          appointmentsRepository
        );

        const firstAvailable = availableSlots.find(slot => slot.available);
        
        if (firstAvailable) {
          Logger.appointment('Found next available slot', {
            barberId,
            date: dateStr,
            time: firstAvailable.time,
            daysFromNow: i
          });

          return {
            date: dateStr,
            slot: firstAvailable,
            daysFromNow: i
          };
        }
      }

      return null; // Nenhum horário disponível nos próximos dias
    } catch (error) {
      Logger.appointment('Error finding next available slot', {
        barberId,
        startDate,
        error: error.message
      });
      throw error;
    }
  }

  // =====================================================
  // 🛠️ UTILITÁRIOS PRIVADOS
  // =====================================================

  formatTime(hour, minute) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  formatDate(date) {
    return date.toISOString().split('T')[0];
  }

  isInLunchTime(slotStart, slotEnd, lunchStart, lunchEnd) {
    // Verifica se o agendamento conflita com horário de almoço
    return (slotStart < lunchEnd && slotEnd > lunchStart);
  }

  hasTimeConflict(slot1Time, slot1Duration, slot2Time, slot2Duration) {
    const [slot1Hour, slot1Minute] = slot1Time.split(':').map(Number);
    const slot1Start = slot1Hour * 60 + slot1Minute;
    const slot1End = slot1Start + slot1Duration;

    const [slot2Hour, slot2Minute] = slot2Time.split(':').map(Number);
    const slot2Start = slot2Hour * 60 + slot2Minute;
    const slot2End = slot2Start + slot2Duration;

    // Verifica se há sobreposição
    return slot1Start < slot2End && slot1End > slot2Start;
  }

  // =====================================================
  // 📊 ESTATÍSTICAS DE DISPONIBILIDADE
  // =====================================================

  calculateAvailabilityStats(slots) {
    const total = slots.length;
    const available = slots.filter(slot => slot.available).length;
    const occupied = total - available;

    return {
      total,
      available,
      occupied,
      occupancyRate: total > 0 ? ((occupied / total) * 100).toFixed(2) : 0,
      availabilityRate: total > 0 ? ((available / total) * 100).toFixed(2) : 0
    };
  }

  // =====================================================
  // 🔧 CONFIGURAÇÕES PERSONALIZADAS POR BARBEIRO
  // =====================================================

  getBarberConfig(barberId, customConfigs = {}) {
    // Permite configurações específicas por barbeiro
    if (customConfigs[barberId]) {
      return { ...this.defaultConfig, ...customConfigs[barberId] };
    }
    return this.defaultConfig;
  }

  // =====================================================
  // 🚫 BLOQUEIO TEMPORÁRIO DE HORÁRIOS
  // =====================================================

  addTemporaryBlock(slots, blockStart, blockEnd, reason = 'Indisponível') {
    return slots.map(slot => {
      const slotTime = slot.time;
      const isBlocked = slotTime >= blockStart && slotTime <= blockEnd;

      if (isBlocked && slot.available) {
        return {
          ...slot,
          available: false,
          reason: reason
        };
      }

      return slot;
    });
  }
}

module.exports = { SlotsGeneratorService };