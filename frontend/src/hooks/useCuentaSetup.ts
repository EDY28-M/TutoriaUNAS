import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './useAuth';
import {
  borrarActivacion,
  completarCuenta,
  confirmarCodigoCuenta,
  leerActivacion,
  solicitarCodigoCuenta,
} from '../services/cuentas';
import type { CodigoSolicitado } from '../services/cuentas';
import type { Role } from '../types/auth';
import { dashboardPath } from '../utils/roles';

export type ModoCuenta = 'registro' | 'activacion' | 'recuperacion';
export function useCuentaSetup(modo: ModoCuenta) {
  const [activacion] = useState(leerActivacion);
  const [correo, setCorreo] = useState(modo === 'activacion' ? (activacion?.correo ?? '') : '');
  const [rol, setRol] = useState<Role>(activacion?.role ?? 'estudiante');
  const [fase, setFase] = useState<'correo' | 'codigo' | 'password' | 'terminado'>('correo');
  const [codigo, setCodigo] = useState('');
  const [password, setPassword] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [reto, setReto] = useState<CodigoSolicitado | null>(null);
  const [ticket, setTicket] = useState('');
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [reenviarHasta, setReenviarHasta] = useState(0);
  const [ahora, setAhora] = useState(Date.now);
  const bloqueo = useRef(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!reenviarHasta) return;
    const timer = window.setInterval(() => setAhora(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [reenviarHasta]);
  async function ejecutar(fn: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'No se pudo completar la operación. Inténtalo nuevamente.',
      );
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  function solicitar() {
    return ejecutar(async () => {
      if (!/^[^\s@]+@unas\.edu\.pe$/i.test(correo.trim()))
        throw new Error('Usa tu correo institucional @unas.edu.pe.');
      const result = await solicitarCodigoCuenta({
        correo: correo.trim(),
        proposito: modo,
        rol,
        tokenActivacion: modo === 'activacion' ? activacion?.tokenActivacion : undefined,
      });
      setReto(result);
      setCodigo('');
      setTicket('');
      setFase('codigo');
      setMensaje(result.mensaje);
      setAhora(Date.now());
      setReenviarHasta(Date.now() + result.reenviarEn * 1000);
    });
  }
  function confirmar() {
    return ejecutar(async () => {
      if (!reto || !/^\d{6}$/.test(codigo)) throw new Error('Introduce el código de seis dígitos.');
      const result = await confirmarCodigoCuenta({
        retoId: reto.retoId,
        codigo,
        tokenActivacion: modo === 'activacion' ? activacion?.tokenActivacion : undefined,
      });
      setTicket(result.ticket);
      setCodigo('');
      setFase('password');
      setMensaje('Correo verificado. Establece tu contraseña personal.');
    });
  }
  function completar() {
    return ejecutar(async () => {
      if (!reto || !ticket) throw new Error('Vuelve a verificar tu correo.');
      if (password.length < 15 || password.length > 128)
        throw new Error('Usa una contraseña de 15 a 128 caracteres. Puedes usar una frase larga.');
      if (password !== confirmacion) throw new Error('Las contraseñas no coinciden.');
      const result = await completarCuenta({ retoId: reto.retoId, ticket, password, confirmacion });
      borrarActivacion();
      setTicket('');
      setFase('terminado');
      if (result.pendienteVinculacion) {
        setFase('terminado');
        setMensaje(
          'Tu cuenta ya está verificada. Coordinación debe vincular tu escuela para habilitar el portal docente.',
        );
      } else {
        // La cuenta ya fue verificada: el acceso ordinario no vuelve a pedir un código.
        setMensaje(
          'Tu cuenta está verificada y la contraseña quedó guardada. Puedes iniciar sesión.',
        );
        try {
          const user = await login(
            { identifier: result.identifier, role: result.role, password },
            true,
          );
          navigate(dashboardPath(user.role), { replace: true });
        } catch {
          setError(
            'La contraseña quedó guardada, pero no se pudo abrir el portal. Vuelve al inicio de sesión.',
          );
        }
      }
      setPassword('');
      setConfirmacion('');
    });
  }
  return {
    activacion,
    correo,
    setCorreo,
    rol,
    setRol,
    fase,
    codigo,
    setCodigo,
    password,
    setPassword,
    confirmacion,
    setConfirmacion,
    error,
    mensaje,
    ocupado,
    reenviarEn: Math.max(0, Math.ceil((reenviarHasta - ahora) / 1000)),
    solicitar,
    confirmar,
    completar,
  };
}
