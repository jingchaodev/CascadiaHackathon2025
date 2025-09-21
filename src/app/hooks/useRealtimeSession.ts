import { useCallback, useRef, useState, useEffect } from 'react';
import {
  RealtimeSession,
  RealtimeAgent,
  OpenAIRealtimeWebRTC,
} from '@openai/agents/realtime';

import { audioFormatForCodec, applyCodecPreferences } from '../lib/codecUtils';
import { useEvent } from '../contexts/EventContext';
import { useHandleSessionHistory } from './useHandleSessionHistory';
import { SessionStatus } from '../types';

export interface RealtimeSessionCallbacks {
  onConnectionChange?: (status: SessionStatus) => void;
  onAgentHandoff?: (agentName: string) => void;
}

export interface ConnectOptions {
  getEphemeralKey: () => Promise<string>;
  initialAgents: RealtimeAgent[];
  audioElement?: HTMLAudioElement;
  extraContext?: Record<string, any>;
  outputGuardrails?: any[];
}

export function useRealtimeSession(callbacks: RealtimeSessionCallbacks = {}) {
  const sessionRef = useRef<RealtimeSession | null>(null);
  const [status, setStatus] = useState<
    SessionStatus
  >('DISCONNECTED');
  const { logClientEvent } = useEvent();

  const updateStatus = useCallback(
    (s: SessionStatus) => {
      setStatus(s);
      callbacks.onConnectionChange?.(s);
      logClientEvent({}, s);
    },
    [callbacks],
  );

  const { logServerEvent } = useEvent();

  const historyHandlers = useHandleSessionHistory().current;

  function handleTransportEvent(event: any) {
    // Handle additional server events that aren't managed by the session
    switch (event.type) {
      case "conversation.item.input_audio_transcription.completed": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.done": {
        historyHandlers.handleTranscriptionCompleted(event);
        break;
      }
      case "response.audio_transcript.delta": {
        historyHandlers.handleTranscriptionDelta(event);
        break;
      }
      default: {
        break;
      } 
    }
  }

  const codecParamRef = useRef<string>(
    (typeof window !== 'undefined'
      ? (new URLSearchParams(window.location.search).get('codec') ?? 'opus')
      : 'opus')
      .toLowerCase(),
  );

  // Wrapper to pass current codec param
  const applyCodec = useCallback(
    (pc: RTCPeerConnection) => applyCodecPreferences(pc, codecParamRef.current),
    [],
  );

  const handleAgentHandoff = (item: any) => {
    const history = item.context.history;
    const lastMessage = history[history.length - 1];
    const agentName = lastMessage.name.split("transfer_to_")[1];
    callbacks.onAgentHandoff?.(agentName);
  };

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const handleSessionError = (...args: any[]) => {
      logServerEvent({
        type: 'error',
        message: args[0],
      });
    };

    session.on('error', handleSessionError);
    session.on('agent_handoff', handleAgentHandoff);
    session.on('agent_tool_start', historyHandlers.handleAgentToolStart);
    session.on('agent_tool_end', historyHandlers.handleAgentToolEnd);
    session.on('history_updated', historyHandlers.handleHistoryUpdated);
    session.on('history_added', historyHandlers.handleHistoryAdded);
    session.on('guardrail_tripped', historyHandlers.handleGuardrailTripped);
    session.on('transport_event', handleTransportEvent);

    return () => {
      session.off('error', handleSessionError);
      session.off('agent_handoff', handleAgentHandoff);
      session.off('agent_tool_start', historyHandlers.handleAgentToolStart);
      session.off('agent_tool_end', historyHandlers.handleAgentToolEnd);
      session.off('history_updated', historyHandlers.handleHistoryUpdated);
      session.off('history_added', historyHandlers.handleHistoryAdded);
      session.off('guardrail_tripped', historyHandlers.handleGuardrailTripped);
      session.off('transport_event', handleTransportEvent);
    };
  }, [historyHandlers, logServerEvent]);

  useEffect(() => {
    const session = sessionRef.current;
    if (!session) return;

    const logTransportEvent = (event: any) => {
      const { type = '(unknown)' } = event ?? {};
      console.info('[RealtimeSession][transport]', type, event);
      logServerEvent(event);
    };

    session.transport.on('*', logTransportEvent);
    session.on('transport_event', logTransportEvent);

    return () => {
      session.transport.off('*', logTransportEvent);
      session.off('transport_event', logTransportEvent);
    };
  }, [logServerEvent]);

  const connect = useCallback(
    async ({
      getEphemeralKey,
      initialAgents,
      audioElement,
      extraContext,
      outputGuardrails,
    }: ConnectOptions) => {
      if (sessionRef.current) {
        console.info('[RealtimeSession] connect skipped - session already active');
        return; // already connected
      }

      console.info('[RealtimeSession] connect invoked', {
        agent: initialAgents[0]?.name,
      });
      updateStatus('CONNECTING');

      const ek = await getEphemeralKey();
      console.info('[RealtimeSession] ephemeral key fetch complete', {
        provided: Boolean(ek),
      });
      const rootAgent = initialAgents[0];

      // This lets you use the codec selector in the UI to force narrow-band (8 kHz) codecs to
      //  simulate how the voice agent sounds over a PSTN/SIP phone call.
      const codecParam = codecParamRef.current;
      const audioFormat = audioFormatForCodec(codecParam);

      console.info('[RealtimeSession] constructing session', {
        agent: rootAgent?.name,
      });
      sessionRef.current = new RealtimeSession(rootAgent, {
        transport: new OpenAIRealtimeWebRTC({
          audioElement,
          // Set preferred codec before offer creation
          changePeerConnection: async (pc: RTCPeerConnection) => {
            applyCodec(pc);
            return pc;
          },
        }),
        model: 'gpt-4o-realtime-preview-2025-06-03',
        config: {
          inputAudioFormat: audioFormat,
          outputAudioFormat: audioFormat,
          inputAudioTranscription: {
            model: 'gpt-4o-mini-transcribe',
          },
          tools: [
            {
              type: 'mcp',
              server_label: 'langflow',
              require_approval: 'never',
              server_url:
                'http://localhost:7860/api/v1/mcp/project/4d8f7027-75b1-40ba-b99f-17984f4ebf21/sse',
            },
          ],
        },
        outputGuardrails: outputGuardrails ?? [],
        context: extraContext ?? {},
      });

      console.info('[RealtimeSession] transport connect starting');
      await sessionRef.current.connect({ apiKey: ek });
      console.info('[RealtimeSession] transport connect resolved', {
        transport: sessionRef.current.transport.constructor.name,
      });
      updateStatus('CONNECTED');
    },
    [callbacks, updateStatus],
  );

  const disconnect = useCallback(() => {
    console.info('[RealtimeSession] disconnect invoked');
    sessionRef.current?.close();
    sessionRef.current = null;
    updateStatus('DISCONNECTED');
  }, [updateStatus]);

  const assertconnected = () => {
    if (!sessionRef.current) throw new Error('RealtimeSession not connected');
  };

  /* ----------------------- message helpers ------------------------- */

  const interrupt = useCallback(() => {
    sessionRef.current?.interrupt();
  }, []);
  
  const sendUserText = useCallback((text: string) => {
    assertconnected();
    sessionRef.current!.sendMessage(text);
  }, []);

  const sendEvent = useCallback((ev: any) => {
    sessionRef.current?.transport.sendEvent(ev);
  }, []);

  const mute = useCallback((m: boolean) => {
    sessionRef.current?.mute(m);
  }, []);

  const pushToTalkStart = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.clear' } as any);
  }, []);

  const pushToTalkStop = useCallback(() => {
    if (!sessionRef.current) return;
    sessionRef.current.transport.sendEvent({ type: 'input_audio_buffer.commit' } as any);
    sessionRef.current.transport.sendEvent({ type: 'response.create' } as any);
  }, []);

  return {
    status,
    connect,
    disconnect,
    sendUserText,
    sendEvent,
    mute,
    pushToTalkStart,
    pushToTalkStop,
    interrupt,
  } as const;
}
