import React from 'react';
import BaseLevel from '../BaseLevel';

const questions = [
  {
    question: 'Pregunta de ejemplo para Mundo 2 Nivel 2',
    options: ['Opción A', 'Opción B', 'Opción C', 'Opción D'],
    correct: 0,
    explanation: 'Explicación de ejemplo.'
  }
];

export default function World2Level2() {
  return (
    <BaseLevel
      worldId={2}
      levelId={2}
      levelName="Nivel 2 del Mundo 2"
      questions={questions}
    />
  );
}
