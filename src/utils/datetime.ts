import { WeekDay } from '../models';

export class DateTimeService {
  /**
   * Converte string de data para objeto Date
   */
  static parseDate(dateString: string): Date {
    return new Date(dateString);
  }

  /**
   * Formata data para string YYYY-MM-DD
   */
  static formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  /**
   * Formata horário para string HH:MM
   */
  static formatTime(date: Date): string {
    return date.toTimeString().slice(0, 5);
  }

  /**
   * Converte horário HH:MM para minutos desde meia-noite
   */
  static timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Converte minutos desde meia-noite para horário HH:MM
   */
  static minutesToTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  }

  /**
   * Obtém o dia da semana (0-6, onde 0 = domingo)
   */
  static getDayOfWeek(date: Date): WeekDay {
    return date.getDay() as WeekDay;
  }

  /**
   * Adiciona minutos a um horário
   */
  static addMinutesToTime(time: string, minutes: number): string {
    const totalMinutes = this.timeToMinutes(time) + minutes;
    
    // Se ultrapassar 24h, retorna o horário do próximo dia (limitado a 24h)
    if (totalMinutes >= 1440) { // 1440 = 24 * 60
      return this.minutesToTime(totalMinutes % 1440);
    }
    
    return this.minutesToTime(totalMinutes);
  }

  /**
   * Verifica se um horário está dentro de um intervalo
   */
  static isTimeInRange(time: string, startTime: string, endTime: string): boolean {
    const timeMinutes = this.timeToMinutes(time);
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    
    return timeMinutes >= startMinutes && timeMinutes <= endMinutes;
  }

  /**
   * Calcula a diferença em minutos entre dois horários
   */
  static timeDifferenceInMinutes(startTime: string, endTime: string): number {
    const startMinutes = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    
    return endMinutes - startMinutes;
  }

  /**
   * Verifica se uma data é hoje
   */
  static isToday(date: Date): boolean {
    const today = new Date();
    return this.formatDate(date) === this.formatDate(today);
  }

  /**
   * Verifica se uma data é no futuro
   */
  static isFuture(date: Date): boolean {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    date.setHours(0, 0, 0, 0);
    
    return date > now;
  }

  /**
   * Verifica se uma data e horário são no futuro
   */
  static isDateTimeInFuture(date: string, time: string): boolean {
    const dateTime = new Date(`${date}T${time}:00`);
    return dateTime > new Date();
  }

  /**
   * Gera uma lista de horários possíveis com base na duração do serviço
   */
  static generateTimeSlots(
    startTime: string,
    endTime: string,
    serviceDuration: number,
    interval: number = 30 // intervalo entre horários em minutos
  ): string[] {
    const slots: string[] = [];
    let currentTime = this.timeToMinutes(startTime);
    const endMinutes = this.timeToMinutes(endTime);
    
    while (currentTime + serviceDuration <= endMinutes) {
      slots.push(this.minutesToTime(currentTime));
      currentTime += interval;
    }
    
    return slots;
  }

  /**
   * Verifica se dois intervalos de tempo se sobrepõem
   */
  static timeRangesOverlap(
    start1: string,
    end1: string,
    start2: string,
    end2: string
  ): boolean {
    const start1Minutes = this.timeToMinutes(start1);
    const end1Minutes = this.timeToMinutes(end1);
    const start2Minutes = this.timeToMinutes(start2);
    const end2Minutes = this.timeToMinutes(end2);
    
    return start1Minutes < end2Minutes && end1Minutes > start2Minutes;
  }

  /**
   * Obtém as datas da semana atual
   */
  static getCurrentWeekDates(): { date: string; dayOfWeek: WeekDay }[] {
    const today = new Date();
    const currentDay = today.getDay();
    const dates: { date: string; dayOfWeek: WeekDay }[] = [];
    
    // Calcular domingo da semana atual
    const sunday = new Date(today);
    sunday.setDate(today.getDate() - currentDay);
    
    // Gerar todas as datas da semana
    for (let i = 0; i < 7; i++) {
      const date = new Date(sunday);
      date.setDate(sunday.getDate() + i);
      
      dates.push({
        date: this.formatDate(date),
        dayOfWeek: i as WeekDay,
      });
    }
    
    return dates;
  }

  /**
   * Obtém o nome do dia da semana em português
   */
  static getDayName(dayOfWeek: WeekDay): string {
    const dayNames = [
      'Domingo',    // 0
      'Segunda',    // 1
      'Terça',      // 2
      'Quarta',     // 3
      'Quinta',     // 4
      'Sexta',      // 5
      'Sábado',     // 6
    ];
    
    return dayNames[dayOfWeek];
  }

  /**
   * Calcula a idade baseada na data de nascimento
   */
  static calculateAge(birthDate: Date): number {
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    return age;
  }
}